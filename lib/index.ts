/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const native = require('../build/Release/windows_process_tree.node');
import { IProcessInfo, IProcessTreeNode, IProcessCpuInfo } from 'windows-process-tree';

export enum ProcessDataFlag {
  None = 0,
  Memory = 1,
  CommandLine = 2
}

interface  IRequest<T> {
  callback: (result: T) => void;
  rootPid: number;
}

type RequestQueue<T> = IRequest<T>[];

// requestInProgress is used for any function that uses CreateToolhelp32Snapshot, as multiple calls
// to this cannot be done at the same time.
let requestInProgress = false;
const processListRequestQueue: RequestQueue<IProcessInfo[] | undefined> = [];
const processTreeRequestQueue: RequestQueue<IProcessTreeNode | undefined> = [];

const MAX_FILTER_DEPTH = 10;

/**
 * Filters a list of processes to rootPid and its descendents and creates a tree
 * @param rootPid The process to use as the root
 * @param processList The list of processes
 * @param maxDepth The maximum depth to search
 */
export function buildProcessTree(rootPid: number, processList: IProcessInfo[], maxDepth: number = MAX_FILTER_DEPTH): IProcessTreeNode | undefined {
  const rootIndex = processList.findIndex(v => v.pid === rootPid);
  if (rootIndex === -1) {
    return undefined;
  }
  const rootProcess = processList[rootIndex];
  const childIndexes = processList.filter(v => v.ppid === rootPid);

  const children: IProcessTreeNode[] = [];

  if (maxDepth !== 0) {
    for (const c of childIndexes) {
      const tree = buildProcessTree(c.pid, processList, maxDepth - 1);
      if (tree) {
        children.push(tree);
      }
    }
  }

  return {
    pid: rootProcess.pid,
    name: rootProcess.name,
    memory: rootProcess.memory,
    commandLine: rootProcess.commandLine,
    children
  };
}

/**
 * Filters processList to contain the process with rootPid and all of its descendants
 * @param rootPid The root pid
 * @param processList The list of all processes
 * @param maxDepth The maximum depth to search
 */
export function filterProcessList(rootPid: number, processList: IProcessInfo[], maxDepth: number = MAX_FILTER_DEPTH): IProcessInfo[] | undefined {
  const rootIndex = processList.findIndex(v => v.pid === rootPid);
  if (rootIndex === -1) {
    return undefined;
  }

  if (maxDepth === -1) {
    return [];
  }

  const rootProcess = processList[rootIndex];
  const childIndexes = processList.filter(v => v.ppid === rootPid);

  const children: IProcessInfo[][] = [];
  for (const c of childIndexes) {
    const list = filterProcessList(c.pid, processList, maxDepth - 1);
    if (list) {
      children.push(list);
    }
  }
  return children.reduce((prev, current) => prev.concat(current), [rootProcess]);
}

function getRawProcessList<T>(
  rootPid: number,
  queue: RequestQueue<T>,
  callback: (result: T) => void,
  transform: (pid: number, processList: IProcessInfo[]) => T,
  flags?: ProcessDataFlag
): void {
  queue.push({ rootPid, callback });

  // Only make a new request if there is not currently a request in progress.
  // This prevents too many requests from being made, there is also a crash that
  // can occur when performing multiple calls to CreateToolhelp32Snapshot at
  // once.
  if (!requestInProgress) {
    requestInProgress = true;
    native.getProcessList((processList: IProcessInfo[]) => {
      // It is possible and valid for one callback to cause another to be added to the queue.
      // To avoid orphaning those callbacks, we repeat the draining until the queue is empty.
      // We use "queue.splice(0)" to atomically clear the queue, returning the batch to process.
      // If any of those also made requests, we repeat until the callback chain completes.
      //
      // An alternative would be to splice the queue once and immediately reset requestInProgress
      // before invoking callbacks: `CreateToolhelp32Snapshot` has safely completed at this point.
      // However, that would circumvent the "too many requests" rate-limiting (?) concern above.
      while (queue.length) {
        queue.splice(0).forEach(r =>
          r.callback(transform(r.rootPid, processList)));
      }
      requestInProgress = false;
    }, flags || 0);
  }
}

/**
 * Returns a list of processes containing the rootPid process and all of its descendants
 * @param rootPid The pid of the process of interest
 * @param callback The callback to use with the returned set of processes
 * @param flags The flags for what process data should be included
 */
export function getProcessList(rootPid: number, callback: (processList: IProcessInfo[] | undefined) => void, flags?: ProcessDataFlag): void {
  getRawProcessList(rootPid, processListRequestQueue, callback, filterProcessList, flags);
}

/**
 * Returns the list of processes annotated with cpu usage information
 * @param processList The list of processes
 * @param callback The callback to use with the returned list of processes
 */
export function getProcessCpuUsage(processList: IProcessInfo[], callback: (tree: IProcessCpuInfo[]) => void): void {
  native.getProcessCpuUsage(processList, (processListWithCpu) => callback(processListWithCpu));
}

/**
 * Returns a tree of processes with rootPid as the root
 * @param rootPid The pid of the process that will be the root of the tree
 * @param callback The callback to use with the returned list of processes
 * @param flags Flags indicating what process data should be written on each node
 */
export function getProcessTree(rootPid: number, callback: (tree: IProcessTreeNode | undefined) => void, flags?: ProcessDataFlag): void {
  getRawProcessList(rootPid, processTreeRequestQueue, callback, buildProcessTree, flags);
}
