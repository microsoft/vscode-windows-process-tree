/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "process.h"
#include "process_arguments.h"
#include <windows.h>
#include <winternl.h>
#include <psapi.h>

bool GetProcessCommandLineArguments(ProcessInfo process_info[1024], uint32_t *process_count) {
  pfnNtQueryInformationProcess gNtQueryInformationProcess = (pfnNtQueryInformationProcess)GetProcAddress(
      GetModuleHandleA("ntdll.dll"), "NtQueryInformationProcess");

  PPROCESS_BASIC_INFORMATION pbi = NULL;
  PEB peb = {NULL};
  RTL_USER_PROCESS_PARAMETERS process_parameters = {NULL};

  // Get process handle
  DWORD pid = process_info[*process_count].pid;
  HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
  if (hProcess == INVALID_HANDLE_VALUE) {
    return FALSE;
  }

  // Get process basic information
  HANDLE heap = GetProcessHeap();
  DWORD pbi_size = sizeof(PROCESS_BASIC_INFORMATION);
  pbi = (PROCESS_BASIC_INFORMATION *)HeapAlloc(heap, HEAP_ZERO_MEMORY, pbi_size);
  if (!pbi) {
    CloseHandle(hProcess);
    return FALSE;
  }

  // Get Process Environment Block (PEB)
  DWORD size_needed;
  NTSTATUS status = gNtQueryInformationProcess(hProcess, ProcessBasicInformation, pbi, pbi_size, &size_needed);
  if (status >= 0 && pbi->PebBaseAddress) {

    // Read PEB
    SIZE_T bytes_read;
    if (ReadProcessMemory(hProcess, pbi->PebBaseAddress, &peb, sizeof(peb), &bytes_read)) {

      // Read the processs parameters
      bytes_read = 0;
      if (ReadProcessMemory(hProcess, peb.ProcessParameters, &process_parameters, sizeof(RTL_USER_PROCESS_PARAMETERS), &bytes_read)) {
        if (process_parameters.CommandLine.Length > 0) {

          // Allocate space to read the command line parameter
          WCHAR *buffer = NULL;
          buffer = (WCHAR *)HeapAlloc(heap, HEAP_ZERO_MEMORY, process_parameters.CommandLine.Length);
          if (buffer) {
            if (ReadProcessMemory(hProcess, process_parameters.CommandLine.Buffer, buffer, process_parameters.CommandLine.Length, &bytes_read)) {

              // Copy only as much as will fit in the arguments property
              DWORD buffer_size = process_parameters.CommandLine.Length >= sizeof(process_info[*process_count].arguments)
                                     ? sizeof(process_info[*process_count].arguments) - sizeof(TCHAR)
                                     : process_parameters.CommandLine.Length;

              WideCharToMultiByte(CP_ACP, 0, buffer,
                                  (int)(buffer_size / sizeof(WCHAR)),
                                  process_info[*process_count].arguments, sizeof(process_info[*process_count].arguments),
                                  NULL, NULL);

              CloseHandle(hProcess);
              HeapFree(heap, 0, pbi);
              return true;
            }
          }
        }
      }
    }
  }

  CloseHandle(hProcess);
  HeapFree(heap, 0, pbi);
  return false;
}
