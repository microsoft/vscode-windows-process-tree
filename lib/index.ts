/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { promisify } from 'util';

const native = process.platform === 'win32' ? require('../build/Release/windows_process_tree.node') : undefined;
import { IProcessInfo, IProcessTreeNode, IProcessCpuInfo } from '@vscode/windows-process-tree';

export enum ProcessDataFlag {
  None = 0,
  Memory = 1,
  CommandLine = 2
}

type RequestCallback = (processList: IProcessInfo[]) => void;

// requestInProgress is used for any function that uses CreateToolhelp32Snapshot, as multiple calls
// to this cannot be done at the same time.
let requestInProgress = false;
const globalRequestQueue: RequestCallback[] = [];

const MAX_FILTER_DEPTH = 10;

interface IProcessInfoNode {
  info: IProcessInfo;
  children: IProcessInfoNode[];
}

/**
 * Construct tree of process infos and their children, returning the requested "root" node.
 * This is performed in a single iteration pass and allows reasonably efficient traversal.
 *
 * @param rootPid the pid of the "root" process to search for
 * @param processList the list of `IProcessInfo`s
 * @returns the `IProcessInfoNode` representing the root and all of its connected children
 */
function buildRawTree(rootPid: number, processList: Iterable<IProcessInfo>): IProcessInfoNode | undefined {
  let root: IProcessInfoNode | undefined;

  // Map of pid to the array of immediate children.
  // Each array is shared by reference, such that:
  // forall n. Object.is(n.children, childrenOf[n.info.pid])
  const childrenOf: { [_: number]: IProcessInfoNode[] | undefined } = {};

  // Iterate over processList (once).
  // Add each process to children of its parent pid.
  // Note the process corresponding to `rootPid` when we see it.
  for (const info of processList) {
    const myChildren = (childrenOf[info.pid] ??= []);
    const mySiblings = (childrenOf[info.ppid] ??= []);

    const node = { info, children: myChildren };
    mySiblings.push(node);

    if (root === undefined && info.pid === rootPid) {
      root = node;
    }
  }

  return root;
}

/**
 * Filters a list of processes to rootPid and its descendents and creates a tree
 * @param rootPid The process to use as the root
 * @param processList The list of processes
 * @param maxDepth The maximum depth to search
 */
export function buildProcessTree(rootPid: number, processList: Iterable<IProcessInfo>, maxDepth: number = MAX_FILTER_DEPTH): IProcessTreeNode | undefined {
  if (process.platform !== 'win32') {
    throw new Error('buildProcessTree is only implemented on Windows');
  }
  const root = buildRawTree(rootPid, processList);
  if (root === undefined) {
    return undefined;
  }

  // This differs from the "raw" tree somewhat trivially.
  // • the properties are inlined/splatted
  // • the 'ppid' field is omitted
  // • the depth of the tree is limited by `maxDepth`
  const buildNode = ({ info: { pid, name, memory, commandLine }, children }: IProcessInfoNode, depth: number): IProcessTreeNode => ({
    pid,
    name,
    memory,
    commandLine,
    children: depth > 0 ? children.map(c => buildNode(c, depth - 1)) : [],
  });

  return buildNode(root, maxDepth);
}

/**
 * Filters processList to contain the process with rootPid and all of its descendants
 * @param rootPid The root pid
 * @param processList The list of all processes
 * @param maxDepth The maximum depth to search
 */
export function filterProcessList(rootPid: number, processList: Iterable<IProcessInfo>, maxDepth: number = MAX_FILTER_DEPTH): IProcessInfo[] | undefined {
  if (process.platform !== 'win32') {
    throw new Error('filterProcessList is only implemented on Windows');
  }
  const root = buildRawTree(rootPid, processList);
  if (root === undefined) {
    return undefined;
  }

  if (maxDepth < 0) {
    return [];
  }

  function buildList({ info, children }: IProcessInfoNode, depth: number, accum: IProcessInfo[]): IProcessInfo[] {
    accum.push(info);
    if (depth > 0) {
      children.forEach(c => buildList(c, depth - 1, accum));
    }
    return accum;
  }

  return buildList(root, maxDepth, []);
}

function getRawProcessList(
  callback: RequestCallback,
  flags?: ProcessDataFlag
): void {
  const queue = globalRequestQueue;

  queue.push(callback);

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
        queue.splice(0).forEach(cb => cb(processList));
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
  if (process.platform !== 'win32') {
    throw new Error('getProcessList is only implemented on Windows');
  }
  getRawProcessList(procs => callback(filterProcessList(rootPid, procs)), flags);
}

export namespace getProcessList {
  // tslint:disable-next-line:variable-name
  export const __promisify__ = (rootPid: number, flags?: ProcessDataFlag): Promise<IProcessInfo[]> => new Promise((resolve, reject) => {
    const callback = (processList: IProcessInfo[] | undefined) => processList
      ? resolve(processList)
      : reject(new Error(`Could not find PID ${rootPid}`));
    getProcessList(rootPid, callback, flags);
  });
}

/**
 * Returns the list of processes annotated with cpu usage information
 * @param processList The list of processes
 * @param callback The callback to use with the returned list of processes
 */
export function getProcessCpuUsage(processList: IProcessInfo[], callback: (tree: IProcessCpuInfo[]) => void): void {
  if (process.platform !== 'win32') {
    throw new Error('getProcessCpuUsage is only implemented on Windows');
  }
  native.getProcessCpuUsage(processList, callback);
}

export namespace getProcessCpuUsage {
  // tslint:disable-next-line:variable-name
  export const __promisify__ = (processList: IProcessInfo[]): Promise<IProcessCpuInfo[]> => new Promise((resolve, reject) => {
    // NOTE: Currently this callback is *never* called with `undefined`, unlike the other functions which do PID lookups.
    // The handling here is just for consistency and future-proofing.
    const callback = (cpuInfos: IProcessCpuInfo[] | undefined) => cpuInfos
      ? resolve(cpuInfos)
      : reject(new Error('Failed to collect CPU info'));
    getProcessCpuUsage(processList, callback);
  });
}

/**
 * Returns a tree of processes with rootPid as the root
 * @param rootPid The pid of the process that will be the root of the tree
 * @param callback The callback to use with the returned list of processes
 * @param flags Flags indicating what process data should be written on each node
 */
export function getProcessTree(rootPid: number, callback: (tree: IProcessTreeNode | undefined) => void, flags?: ProcessDataFlag): void {
  if (process.platform !== 'win32') {
    throw new Error('getProcessTree is only implemented on Windows');
  }
  getRawProcessList(procs => callback(buildProcessTree(rootPid, procs)), flags);
}

export namespace getProcessTree {
  // tslint:disable-next-line:variable-name
  export const __promisify__ = (rootPid: number, flags?: ProcessDataFlag): Promise<IProcessTreeNode> => new Promise((resolve, reject) => {
    const callback = (tree: IProcessTreeNode | undefined) => tree
      ? resolve(tree)
      : reject(new Error(`Could not find PID ${rootPid}`));
    getProcessTree(rootPid, callback, flags);
  });
}

// Since symbol properties can't be declared via namespace merging, we just define __promisify__ that way and
// and manually set the "modern" promisify symbol: https://github.com/microsoft/TypeScript/issues/36813
[getProcessTree, getProcessList, getProcessCpuUsage].forEach(func =>
  Object.defineProperty(func, promisify.custom, { enumerable: false, value: func.__promisify__ }));
