/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_PROCESS_WORKER_H
#define SRC_PROCESS_WORKER_H

#include <nan.h>
#include "process.h"

class GetProcessesWorker : public Nan::AsyncWorker {
 public:
  GetProcessesWorker(Nan::Callback* callback, DWORD* process_data_flags);
  ~GetProcessesWorker();

  void Execute();
  void HandleOKCallback();
 private:
  ProcessInfo* process_info;
  uint32_t* process_count;
  DWORD* process_data_flags;

};

#endif  // SRC_PROCESS_WORKER_H
