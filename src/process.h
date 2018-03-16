/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_PROCESS_H_
#define SRC_PROCESS_H_

#include <nan.h>
#include <windows.h>

struct Cpu {
  double pcpu;
  ULONGLONG initialProcRunTime;
  ULONGLONG initialSystemTime;
};

struct ProcessInfo {
  TCHAR name[MAX_PATH];
  DWORD pid;
  DWORD ppid;
  DWORD memory; // Reported in bytes
  Cpu cpu;
};

enum ProcessDataFlags {
  NONE = 0,
  MEMORY = 1,
  CPU = 2
};

void GetRawProcessList(ProcessInfo process_info[1024], uint32_t* process_count, DWORD* flags);

void BuildProcessList(DWORD* pid, ProcessInfo process_info[1024], uint32_t* process_count, ProcessInfo matching_processes[1024], uint32_t* matching_process_count);

void GetProcessMemoryUsage(ProcessInfo process_info[1024], uint32_t* process_count);

void GetCpuUsage(ProcessInfo process_info[1024], uint32_t* process_count, BOOL first_run);

#endif  // SRC_PROCESS_H_
