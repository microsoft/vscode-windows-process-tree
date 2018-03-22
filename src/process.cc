/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "process.h"
#include "process_arguments.h"

#include <tlhelp32.h>
#include <psapi.h>
#include <limits>

void GetRawProcessList(ProcessInfo process_info[1024], uint32_t* process_count, DWORD* process_data_flags) {
  *process_count = 0;

  // Fetch the PID and PPIDs
  PROCESSENTRY32 process_entry = { 0 };
  DWORD parent_pid = 0;
  HANDLE snapshot_handle = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  process_entry.dwSize = sizeof(PROCESSENTRY32);
  if (Process32First(snapshot_handle, &process_entry)) {
    do {
      if (process_entry.th32ProcessID != 0) {
        process_info[*process_count].pid = process_entry.th32ProcessID;
        process_info[*process_count].ppid = process_entry.th32ParentProcessID;

        if (MEMORY & *process_data_flags) {
          GetProcessMemoryUsage(process_info, process_count);
        }

        if (ARGUMENTS & *process_data_flags) {
          GetProcessCommandLineArguments(process_info, process_count);
        }

        strcpy(process_info[*process_count].name, process_entry.szExeFile);
        (*process_count)++;
      }
    } while (*process_count < 1024 && Process32Next(snapshot_handle, &process_entry));
  }

  CloseHandle(snapshot_handle);
}

void GetProcessMemoryUsage(ProcessInfo process_info[1024], uint32_t* process_count) {
  DWORD pid = process_info[*process_count].pid;
  HANDLE hProcess;
  PROCESS_MEMORY_COUNTERS pmc;

  hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);

  if (hProcess == NULL) {
    return;
  }

  if (GetProcessMemoryInfo(hProcess, &pmc, sizeof(pmc))) {
    process_info[*process_count].memory = (DWORD)pmc.WorkingSetSize;
  }
}

// Per documentation, it is not recommended to add or subtract values from the FILETIME
// structure, or to cast it to ULARGE_INTEGER as this can cause alignment faults on 64-bit Windows.
// Copy the high and low part to a ULARGE_INTEGER and peform arithmetic on that instead.
// See https://msdn.microsoft.com/en-us/library/windows/desktop/ms724284(v=vs.85).aspx
ULONGLONG GetTotalTime(const FILETIME* kernelTime, const FILETIME* userTime) {
  ULARGE_INTEGER kt, ut;
  kt.LowPart = (*kernelTime).dwLowDateTime;
  kt.HighPart = (*kernelTime).dwHighDateTime;

  ut.LowPart = (*userTime).dwLowDateTime;
  ut.HighPart = (*userTime).dwHighDateTime;

  return kt.QuadPart + ut.QuadPart;
}

void GetCpuUsage(Cpu* cpu_info, uint32_t* process_index, BOOL first_pass) {
  DWORD pid = cpu_info[*process_index].pid;
  HANDLE hProcess;

  hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);

  if (hProcess == NULL) {
    return;
  }

  FILETIME creationTime, exitTime, kernelTime, userTime;
  FILETIME sysIdleTime, sysKernelTime, sysUserTime;
  if (GetProcessTimes(hProcess, &creationTime, &exitTime, &kernelTime, &userTime)
    && GetSystemTimes(&sysIdleTime, &sysKernelTime, &sysUserTime)) {
    if (first_pass) {
      cpu_info[*process_index].initialProcRunTime = GetTotalTime(&kernelTime, &userTime);
      cpu_info[*process_index].initialSystemTime = GetTotalTime(&sysKernelTime, &sysUserTime);
    } else {
      ULONGLONG endProcTime = GetTotalTime(&kernelTime, &userTime);
      ULONGLONG endSysTime = GetTotalTime(&sysKernelTime, &sysUserTime);

      cpu_info[*process_index].cpu = 100.0 * (endProcTime - cpu_info[*process_index].initialProcRunTime) / (endSysTime - cpu_info[*process_index].initialSystemTime);
    }
  } else {
    cpu_info[*process_index].cpu = std::numeric_limits<double>::quiet_NaN();
  }

  CloseHandle(hProcess);
}