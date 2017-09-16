/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

let native = require('../build/Release/windows_process_tree.node');

let requestInProgress = false;
let requestQueue = [];

function buildProcessTree(processList, rootPid) {
  let rootIndex = processList.findIndex(v => v.pid === rootPid);
  if (rootIndex === -1) {
    return undefined;
  }
  let rootProcess = processList[rootIndex];
  let childIndexes = processList.filter(v => v.ppid === rootPid);

  return {
    pid: rootProcess.pid,
    name: rootProcess.name,
    children: childIndexes.map(c => buildProcessTree(processList, c.pid))
  };
}

function getProcessTree(rootPid, callback) {
  // Push the request to the queue
  requestQueue.push({
    callback: callback,
    rootPid: rootPid || process.pid
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
    });
  }
}

module.exports = getProcessTree;
