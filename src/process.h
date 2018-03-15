/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_PROCESS_H_
#define SRC_PROCESS_H_

#include <nan.h>
#include <windows.h>

struct ProcessInfo {
  TCHAR name[MAX_PATH];
  DWORD pid;
  DWORD ppid;
  DWORD memory; // Reported in bytes
};

enum ProcessDataFlags {
  NONE = 0,
  MEMORY = 1
};

void GetRawProcessList(ProcessInfo process_info[1024], uint32_t* process_count, DWORD* flags);

void GetProcessMemoryUsage(ProcessInfo process_info[1024], uint32_t* process_count);

#endif  // SRC_PROCESS_H_
