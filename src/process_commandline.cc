/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "process.h"
#include "process_commandline.h"
#include <windows.h>
#include <winternl.h>
#include <iostream>

bool GetProcessCommandLine(ProcessInfo& process_info) {
  HINSTANCE ntdll = GetModuleHandleW(L"ntdll.dll");
  if (!ntdll) {
    return false;
  }

  decltype(NtQueryInformationProcess)* nt_query_information_process =
      reinterpret_cast<decltype(NtQueryInformationProcess)*>(
          GetProcAddress(ntdll, "NtQueryInformationProcess"));

  if (!nt_query_information_process) {
    return false;
  }

  PROCESS_BASIC_INFORMATION pbi{};
  PEB peb = {NULL};
  RTL_USER_PROCESS_PARAMETERS process_parameters = {NULL};

  // Get process handle
  DWORD pid = process_info.pid;
  HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
  if (hProcess == INVALID_HANDLE_VALUE) {
    return false;
  }

  // Get Process Environment Block (PEB)
  NTSTATUS status = nt_query_information_process(hProcess, ProcessBasicInformation, &pbi, sizeof(pbi), nullptr);
  if (NT_SUCCESS(status) && pbi.PebBaseAddress) {
    // Read PEB
    if (ReadProcessMemory(hProcess, pbi.PebBaseAddress, &peb, sizeof(peb), nullptr)) {
      // Read the processs parameters
      if (ReadProcessMemory(hProcess, peb.ProcessParameters, &process_parameters, sizeof(RTL_USER_PROCESS_PARAMETERS), nullptr)) {
        if (process_parameters.CommandLine.Length > 0) {
          std::wstring buffer;
          buffer.resize(process_parameters.CommandLine.Length / sizeof(wchar_t));
          if (ReadProcessMemory(hProcess, process_parameters.CommandLine.Buffer, &buffer[0], process_parameters.CommandLine.Length, nullptr)) {
            int wide_length = static_cast<int>(buffer.length());
            int charcount = WideCharToMultiByte(CP_ACP, 0, buffer.data(), wide_length,
                                      NULL, 0, NULL, NULL);
            if (charcount) {
              process_info.commandLine.resize(static_cast<size_t>(charcount));
              WideCharToMultiByte(CP_ACP, 0, buffer.data(), wide_length,
                                  &process_info.commandLine[0], charcount,
                                  NULL, NULL);
            }
            CloseHandle(hProcess);
            return true;
          }
        }
      }
    }
  }

  CloseHandle(hProcess);
  return false;
}
