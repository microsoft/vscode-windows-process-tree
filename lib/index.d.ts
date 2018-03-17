export declare enum ProcessDataFlag {
    None = 0,
    Memory = 1,
}
export interface ProcessTreeNode {
    pid: number;
    name: string;
    memory?: number;
    children: ProcessTreeNode[];
}
export declare function getProcessTree(rootPid: number, callback: (tree: ProcessTreeNode) => void, flags?: ProcessDataFlag): void;
