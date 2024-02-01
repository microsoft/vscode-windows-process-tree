/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_PROCESS_H_
#define SRC_PROCESS_H_

#include <napi.h>
#include <windows.h>

struct Cpu {
  DWORD pid;
  double cpu;
  ULONGLONG initialProcRunTime;
  ULONGLONG initialSystemTime;
};

struct ProcessInfo {
  TCHAR name[MAX_PATH];
  DWORD pid;
  DWORD ppid;
  DWORD memory; // Reported in bytes
  std::string commandLine;
};

enum ProcessDataFlags {
  NONE = 0,
  MEMORY = 1,
  COMMANDLINE = 2
};

uint32_t GetRawProcessList(std::vector<ProcessInfo>& process_info, DWORD flags);

void GetProcessMemoryUsage(ProcessInfo& process_info);

void GetCpuUsage(Cpu& cpu_info, bool first_run);

#endif  // SRC_PROCESS_H_
