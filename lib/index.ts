/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const native = require('../build/Release/windows_process_tree.node');
import { IProcessInfo, IProcessTreeNode, IProcessCpuInfo } from 'windows-process-tree';

export enum ProcessDataFlag {
  None = 0,
  Memory = 1
}

interface  IRequest {
  callback: (processes: IProcessTreeNode | IProcessInfo[]) => void;
  rootPid: number;
}

type RequestQueue = IRequest[];

// requestInProgress is used for any function that uses CreateToolhelp32Snapshot, as multiple calls
// to this cannot be done at the same time.
let requestInProgress = false;
const processListRequestQueue: RequestQueue = [];
const processTreeRequestQueue: RequestQueue = [];

/**
 * Filters a list of processes to rootPid and its descendents and creates a tree
 * @param rootPid The process to use as the root
 * @param processList The list of processes
 */
function buildProcessTree( rootPid: number, processList: IProcessInfo[]): IProcessTreeNode {
  const rootIndex = processList.findIndex(v => v.pid === rootPid);
  if (rootIndex === -1) {
    return undefined;
  }
  const rootProcess = processList[rootIndex];
  const childIndexes = processList.filter(v => v.ppid === rootPid);

  return {
    pid: rootProcess.pid,
    name: rootProcess.name,
    memory: rootProcess.memory,
    children: childIndexes.map(c => buildProcessTree(c.pid, processList))
  };
}

/**
 * Filters processList to contain the process with rootPid and all of its descendants
 * @param rootPid The root pid
 * @param processList The list of all processes
 */
function filterProcessList(rootPid: number, processList: IProcessInfo[]): IProcessInfo[] {
  const rootIndex = processList.findIndex(v => v.pid === rootPid);
  if (rootIndex === -1) {
    return undefined;
  }

  const rootProcess = processList[rootIndex];
  const childIndexes = processList.filter(v => v.ppid === rootPid);
  return childIndexes.map(c => filterProcessList(c.pid, processList)).reduce((prev, current) => prev.concat(current), [rootProcess]);
}

function getRawProcessList(
  pid: number,
  queue: RequestQueue,
  callback: (processList: IProcessInfo[] | IProcessTreeNode) => void,
  filter: (pid: number, processList: IProcessInfo[]) => IProcessInfo[] | IProcessTreeNode,
  flags?: ProcessDataFlag
): void {
  queue.push({
    callback: callback,
    rootPid: pid
  });

  // Only make a new request if there is not currently a request in progress.
  // This prevents too many requests from being made, there is also a crash that
  // can occur when performing multiple calls to CreateToolhelp32Snapshot at
  // once.
  if (!requestInProgress) {
    requestInProgress = true;
    native.getProcessList((processList: IProcessInfo[]) => {
      queue.forEach(r => {
        r.callback(filter(r.rootPid, processList));
      });
      queue.length = 0;
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
export function getProcessList(rootPid: number, callback: (processList: IProcessInfo[]) => void, flags?: ProcessDataFlag): void {
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
export function getProcessTree(rootPid: number, callback: (tree: IProcessTreeNode) => void, flags?: ProcessDataFlag): void {
  getRawProcessList(rootPid, processTreeRequestQueue, callback, buildProcessTree, flags);
}
