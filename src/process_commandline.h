/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_PROCESS_COMMANDLINE_H_
#define SRC_PROCESS_COMMANDLINE_H_

#include "process.h"
#include <winternl.h>

typedef NTSTATUS(NTAPI *pfnNtQueryInformationProcess)(
  IN HANDLE ProcessHandle,
  IN PROCESSINFOCLASS ProcessInformationClass,
  OUT PVOID ProcessInformation,
  IN ULONG ProcessInformationLength,
  OUT PULONG ReturnLength OPTIONAL);

bool GetProcessCommandLine(ProcessInfo& process_info);

#endif