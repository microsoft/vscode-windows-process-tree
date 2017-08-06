/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

var native = require('bindings')('windows_process_tree');

function buildProcessTree(processList, rootPid) {
  let rootIndex = processList.findIndex(v => v.pid === rootPid);
  let rootProcess = processList[rootIndex];
  let childIndexes = processList.filter(v => v.ppid === rootPid);

  return {
    pid: rootProcess.pid,
    name: rootProcess.name,
    children: childIndexes.map(c => buildProcessTree(processList, c.pid))
  };
}

function getProcessTree(rootPid) {
  rootPid = rootPid || process.pid;
  return buildProcessTree(native.getProcessList(), rootPid);
}

module.exports = getProcessTree;
