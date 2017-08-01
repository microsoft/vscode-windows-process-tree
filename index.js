var native = require('bindings')('windows_process_tree');

function buildProcessTree(processList, rootPid) {
  
  // Find the root PID's index in the array
  let rootIndex = processList.findIndex(v => v.pid === rootPid);
  let rootProcess = processList[rootIndex];

  // Initialize return object
  var result = {};
  result.pid = rootProcess.pid;
  result.name = rootProcess.name;
  
  // Construct all child trees recursively
  let childIndexes = processList.filter(v => v.ppid === rootPid);
  result.children = childIndexes.map(c => buildProcessTree(processList, c.pid));
  
  return result;
}

function getProcessTree(rootPid) {
  return buildProcessTree(native.getProcessList(), rootPid);
}

module.exports = getProcessTree;