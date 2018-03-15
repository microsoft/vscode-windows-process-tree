/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/



declare module 'windows-process-tree' {
	export enum ProcessDataFlag {
		Memory = 1
	}

	export interface ProcessTreeNode {
		pid: number,
		name: string,
		memory?: number,
		children: ProcessTreeNode[]
	}

	function get(rootPid: number, callback: (tree: ProcessTreeNode) => void, flag?: ProcessDataFlag): void;

	export = get;
}
