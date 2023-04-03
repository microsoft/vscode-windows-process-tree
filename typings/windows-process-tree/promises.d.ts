/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module '@vscode/windows-process-tree/promises' {
  import {
    IProcessCpuInfo,
    IProcessInfo,
    IProcessTreeNode,
    ProcessDataFlag,
  } from '@vscode/windows-process-tree';

  export {
    IProcessCpuInfo,
    IProcessInfo,
    IProcessTreeNode,
    ProcessDataFlag,
  } from '@vscode/windows-process-tree';

  /**
   * Returns a tree of processes with the rootPid process as the root.
   * @param rootPid - The pid of the process that will be the root of the tree.
   * @param flags - The flags for what process data should be included.
   */
  export function getProcessTree(rootPid: number, flags?: ProcessDataFlag): Promise<IProcessTreeNode>;

  /**
   * Returns a list of processes containing the rootPid process and all of its descendants.
   * @param rootPid - The pid of the process of interest.
   * @param flags - The flags for what process data should be included.
   */
  export function getProcessList(rootPid: number, flags?: ProcessDataFlag): Promise<IProcessInfo[]>;

  /**
   * Returns the list of processes annotated with cpu usage information.
   * @param processList - The list of processes.
   */
  export function getProcessCpuUsage(processList: IProcessInfo[]): Promise<IProcessCpuInfo[]>;
}
