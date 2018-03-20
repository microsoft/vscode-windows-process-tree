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

// requestInProgress is used for any function that uses CreateToolhelp32Snapshot, as multiple calls
// to this cannot be done at the same time.
let requestInProgress = false;
let cpuUsageRequestInProgress = false;

const requestQueue = {
  getProcessCpuUsage: [],
  getProcessList: [],
  getProcessTree: []
};

/**
 * Filters a list of processes to rootPid and its descendents and creates a tree
 * @param processList The list of processes
 * @param rootPid The process to use as the root
 */
function buildProcessTree(processList: IProcessInfo[], rootPid: number): IProcessTreeNode {
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
    children: childIndexes.map(c => buildProcessTree(processList, c.pid))
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

/**
 * Returns a list of processes containing the rootPid process and all of its descendants
 * @param rootPid The pid of the process of interest
 * @param callback The callback to use with the returned set of processes
 * @param flags The flags for what process data should be included
 */
export function getProcessList(rootPid: number, callback: (processList: IProcessInfo[]) => void, flags?: ProcessDataFlag): void {
  // Push the request to the queue
  requestQueue.getProcessList.push({
    callback: callback,
    rootPid: rootPid
  });

  // Only make a new request if there is not currently a request in progress.
  // This prevents too many requests from being made, there is also a crash that
  // can occur when performing multiple calls to CreateToolhelp32Snapshot at
  // once.
  if (!requestInProgress) {
    requestInProgress = true;
    native.getProcessList((processList) => {
      requestQueue.getProcessList.forEach(r => {
        r.callback(filterProcessList(r.rootPid, processList));
      });
      requestQueue.getProcessList.length = 0;
      requestInProgress = false;
    }, flags || 0);
  }
}

/**
 * Returns the list of processes annotated with cpu usage information
 * @param processList The list of processes
 * @param callback The callback to use with the returned list of processes
 */
export function getProcessCpuUsage(processList: IProcessInfo[], callback: (tree: IProcessCpuInfo[]) => void): void {
    // Push the request to the queue
    requestQueue.getProcessCpuUsage.push({
      callback: callback
    });

    if (!cpuUsageRequestInProgress) {
      cpuUsageRequestInProgress = true;
      native.getProcessCpuUsage(processList, (processListWithCpu) => {
        requestQueue.getProcessCpuUsage.forEach(r => {
          r.callback(processListWithCpu);
        });
        requestQueue.getProcessCpuUsage.length = 0;
        cpuUsageRequestInProgress = false;
      });
    }
}

/**
 * Returns a tree of processes with rootPid as the root
 * @param rootPid The pid of the process that will be the root of the tree
 * @param callback The callback to use with the returned list of processes
 * @param flags Flags indicating what process data should be written on each node
 */
export function getProcessTree(rootPid: number, callback: (tree: IProcessTreeNode) => void, flags?: ProcessDataFlag): void {
  // Push the request to the queue
  requestQueue.getProcessTree.push({
    callback: callback,
    rootPid: rootPid
  });

  // Only make a new request if there is not currently a request in progress.
  // This prevents too many requests from being made, there is also a crash that
  // can occur when performing multiple calls to CreateToolhelp32Snapshot at
  // once.
  if (!requestInProgress) {
    requestInProgress = true;
    native.getProcessList((processList) => {
      requestQueue.getProcessTree.forEach(r => {
        r.callback(buildProcessTree(processList, r.rootPid));
      });
      requestQueue.getProcessTree.length = 0;
      requestInProgress = false;
    }, flags || 0);
  }
}
