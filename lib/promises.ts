/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { promisify } from 'util';

import * as wpc from './index';

export { ProcessDataFlag } from './index';

export const getProcessTree = promisify(wpc.getProcessTree);
export const getProcessList = promisify(wpc.getProcessList);
export const getProcessCpuUsage = promisify(wpc.getProcessCpuUsage);
