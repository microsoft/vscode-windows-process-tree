/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "process.h"
#include "process_commandline.h"

#include <tlhelp32.h>
#include <psapi.h>
#include <limits>

uint32_t GetRawProcessList(std::vector<ProcessInfo>& process_info,
                           DWORD process_data_flags) {
  // Fetch the PID and PPIDs
  PROCESSENTRY32 process_entry = { 0 };
  DWORD parent_pid = 0;
  uint32_t process_count = 0;
  HANDLE snapshot_handle = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  process_entry.dwSize = sizeof(PROCESSENTRY32);
  if (Process32First(snapshot_handle, &process_entry)) {
    do {
      if (process_entry.th32ProcessID != 0) {
        ProcessInfo pinfo;
        pinfo.pid = process_entry.th32ProcessID;
        pinfo.ppid = process_entry.th32ParentProcessID;

        if (MEMORY & process_data_flags) {
          GetProcessMemoryUsage(pinfo);
        }

        if (COMMANDLINE & process_data_flags) {
          GetProcessCommandLine(pinfo);
        }

        strcpy(pinfo.name, process_entry.szExeFile);
        process_info.push_back(std::move(pinfo));
        process_count++;
      }
    } while (process_count < 1024 && Process32Next(snapshot_handle, &process_entry));
  }

  CloseHandle(snapshot_handle);
  return process_count;
}

void GetProcessMemoryUsage(ProcessInfo& process_info) {
  DWORD pid = process_info.pid;
  HANDLE hProcess;
  PROCESS_MEMORY_COUNTERS pmc;

  hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);

  if (hProcess == NULL) {
    return;
  }

  if (GetProcessMemoryInfo(hProcess, &pmc, sizeof(pmc))) {
    process_info.memory = (DWORD)pmc.WorkingSetSize;
  }

  CloseHandle(hProcess);
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

void GetCpuUsage(Cpu& cpu_info, bool first_pass) {
  DWORD pid = cpu_info.pid;
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
      cpu_info.initialProcRunTime = GetTotalTime(&kernelTime, &userTime);
      cpu_info.initialSystemTime = GetTotalTime(&sysKernelTime, &sysUserTime);
    } else {
      ULONGLONG endProcTime = GetTotalTime(&kernelTime, &userTime);
      ULONGLONG endSysTime = GetTotalTime(&sysKernelTime, &sysUserTime);

      cpu_info.cpu = 100.0 * (endProcTime - cpu_info.initialProcRunTime) / (endSysTime - cpu_info.initialSystemTime);
    }
  } else {
    cpu_info.cpu = std::numeric_limits<double>::quiet_NaN();
  }

  CloseHandle(hProcess);
}