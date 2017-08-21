/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

let native = require('../build/Release/windows_process_tree.node');

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
  rootPid = rootPid || process.pid;
  native.getProcessList((processList) => {
    callback(buildProcessTree(processList, rootPid));
  });
}

module.exports = getProcessTree;
