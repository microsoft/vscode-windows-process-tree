/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "process.h"

#include <tlhelp32.h>

void GetRawProcessList(ProcessInfo process_info[1024], uint32_t* process_count) {
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
        strcpy(process_info[*process_count].name, process_entry.szExeFile);
        (*process_count)++;
      }
    } while (Process32Next(snapshot_handle, &process_entry));
  }
  CloseHandle(snapshot_handle);
}
