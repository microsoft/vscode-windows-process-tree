/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const native = require('../build/Release/windows_process_tree.node');
import { IProcessTreeNode } from 'windows-process-tree';

export enum ProcessDataFlag {
    None = 0,
    Memory = 1
  }

interface IProcessInfo {
    pid: number;
    ppid: number;
    name: string;
    memory?: number;
}

let requestInProgress = false;
const requestQueue = [];

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
    cpu: rootProcess.pcpu,
    children: childIndexes.map(c => buildProcessTree(processList, c.pid))
  };
}

export function getProcessTree(rootPid: number, callback: (tree: IProcessTreeNode) => void, flags?: ProcessDataFlag): void {
  // Push the request to the queue
  requestQueue.push({
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
      requestQueue.forEach(r => {
        r.callback(buildProcessTree(processList, r.rootPid));
      });
      requestQueue.length = 0;
      requestInProgress = false;
    }, flags || 0);
  }
}
