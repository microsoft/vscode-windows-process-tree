/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/



declare module 'windows-process-tree' {
	export enum ProcessDataFlag {
		None = 0,
		Memory = 1
	}

	export interface ProcessTreeNode {
		pid: number,
		name: string,
		memory?: number,
		children: ProcessTreeNode[]
	}

	export function get(rootPid: number, callback: (tree: ProcessTreeNode) => void, flags?: ProcessDataFlag): void;
}
