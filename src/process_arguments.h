/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_PROCESS_ARGUMENTS_H_
#define SRC_PROCESS_ARGUMENTS_H_

#include "process.h"
#include <winternl.h>

typedef NTSTATUS(NTAPI *pfnNtQueryInformationProcess)(
  IN HANDLE ProcessHandle,
  IN PROCESSINFOCLASS ProcessInformationClass,
  OUT PVOID ProcessInformation,
  IN ULONG ProcessInformationLength,
  OUT PULONG ReturnLength OPTIONAL);

bool GetProcessCommandLineArguments(ProcessInfo process_info[1024], uint32_t *process_count);

#endif