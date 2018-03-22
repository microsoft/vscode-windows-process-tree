/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'windows-process-tree' {
  export enum ProcessDataFlag {
    None = 0,
    Memory = 1,
    Arguments = 2
  }

  export interface IProcessInfo {
    pid: number;
    ppid: number;
    name: string;
    memory?: number;
    arguments?: string;
  }

  export interface IProcessCpuInfo extends IProcessInfo {
    cpu?: number;
  }

  export interface IProcessTreeNode  {
    pid: number;
    name: string;
    memory?: number;
    arguments?: string;
    children: IProcessTreeNode[];
  }

  /**
   * Returns a tree of processes with the rootPid process as the root.
   * @param {number} rootPid - The pid of the process that will be the root of the tree.
   * @param {(tree: IProcessTreeNode) => void} callback - The callback to use with the returned list of processes.
   * @param {ProcessDataFlag} flags - The flags for what process data should be included.
   */
  export function getProcessTree(rootPid: number, callback: (tree: IProcessTreeNode) => void, flags?: ProcessDataFlag): void;

  /**
   * Returns a list of processes containing the rootPid process and all of its descendants.
   * @param {number} rootPid - The pid of the process of interest.
   * @param {(processList: IProcessInfo[]) => void} callback - The callback to use with the returned set of processes.
   * @param {ProcessDataFlag} flags - The flags for what process data should be included.
   */
  export function getProcessList(rootPid: number, callback: (processList: IProcessInfo[]) => void, flags?: ProcessDataFlag): void;

  /**
   * Returns the list of processes annotated with cpu usage information.
   * @param {processList: IProcessInfo[]} processList - The list of processes.
   * @param {(processListWithCpu: IProcessCpuInfo[]) => void} callback - The callback to use with the returned list of processes.
   */
  export function getProcessCpuUsage(processList: IProcessInfo[], callback: (processListWithCpu: IProcessCpuInfo[]) => void);
}
