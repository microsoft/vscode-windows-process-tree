"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const native = require('../build/Release/windows_process_tree.node');
var ProcessDataFlag;
(function (ProcessDataFlag) {
    ProcessDataFlag[ProcessDataFlag["None"] = 0] = "None";
    ProcessDataFlag[ProcessDataFlag["Memory"] = 1] = "Memory";
    ProcessDataFlag[ProcessDataFlag["CommandLine"] = 2] = "CommandLine";
})(ProcessDataFlag = exports.ProcessDataFlag || (exports.ProcessDataFlag = {}));
// requestInProgress is used for any function that uses CreateToolhelp32Snapshot, as multiple calls
// to this cannot be done at the same time.
let requestInProgress = false;
const processListRequestQueue = [];
const processTreeRequestQueue = [];
const MAX_FILTER_DEPTH = 10;
/**
 * Filters a list of processes to rootPid and its descendents and creates a tree
 * @param rootPid The process to use as the root
 * @param processList The list of processes
 * @param maxDepth The maximum depth to search
 */
function buildProcessTree(rootPid, processList, maxDepth) {
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
        commandLine: rootProcess.commandLine,
        children: maxDepth === 0 ? [] : childIndexes.map(c => buildProcessTree(c.pid, processList, maxDepth - 1))
    };
}
exports.buildProcessTree = buildProcessTree;
/**
 * Filters processList to contain the process with rootPid and all of its descendants
 * @param rootPid The root pid
 * @param processList The list of all processes
 * @param maxDepth The maximum depth to search
 */
function filterProcessList(rootPid, processList, maxDepth) {
    const rootIndex = processList.findIndex(v => v.pid === rootPid);
    if (rootIndex === -1) {
        return undefined;
    }
    if (maxDepth === -1) {
        return [];
    }
    const rootProcess = processList[rootIndex];
    const childIndexes = processList.filter(v => v.ppid === rootPid);
    return childIndexes.map(c => filterProcessList(c.pid, processList, maxDepth - 1)).reduce((prev, current) => prev.concat(current), [rootProcess]);
}
exports.filterProcessList = filterProcessList;
function getRawProcessList(pid, queue, callback, filter, flags) {
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
        native.getProcessList((processList) => {
            queue.forEach(r => {
                r.callback(filter(r.rootPid, processList, MAX_FILTER_DEPTH));
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
function getProcessList(rootPid, callback, flags) {
    getRawProcessList(rootPid, processListRequestQueue, callback, filterProcessList, flags);
}
exports.getProcessList = getProcessList;
/**
 * Returns the list of processes annotated with cpu usage information
 * @param processList The list of processes
 * @param callback The callback to use with the returned list of processes
 */
function getProcessCpuUsage(processList, callback) {
    native.getProcessCpuUsage(processList, (processListWithCpu) => callback(processListWithCpu));
}
exports.getProcessCpuUsage = getProcessCpuUsage;
/**
 * Returns a tree of processes with rootPid as the root
 * @param rootPid The pid of the process that will be the root of the tree
 * @param callback The callback to use with the returned list of processes
 * @param flags Flags indicating what process data should be written on each node
 */
function getProcessTree(rootPid, callback, flags) {
    getRawProcessList(rootPid, processTreeRequestQueue, callback, buildProcessTree, flags);
}
exports.getProcessTree = getProcessTree;
//# sourceMappingURL=index.js.map