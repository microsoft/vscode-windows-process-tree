/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'windows-process-tree' {
  export enum ProcessDataFlag {
    None = 0,
    Memory = 1
  }

  export interface IProcessInfo {
    pid: number;
    ppid: number;
    name: string;
    memory?: number;
  }

  export interface IProcessCpuInfo extends IProcessInfo {
    cpu?: number;
  }

  export interface IProcessTreeNode  {
    pid: number;
    name: string;
    memory?: number;
    children: IProcessTreeNode[];
  }

  export function getProcessTree(rootPid: number, callback: (tree: IProcessTreeNode) => void, flags?: ProcessDataFlag): void;

  export function getProcessList(rootPid: number, callback: (processList: IProcessInfo[]) => void, flags?: ProcessDataFlag): void;

  export function getProcessCpuUsage(processList: IProcessInfo[], callback: (processListWithCpu: IProcessCpuInfo[]) => void);
}
