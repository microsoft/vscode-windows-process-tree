/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_WORKER_H_
#define SRC_WORKER_H_

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

class GetCPUWorker : public Nan::AsyncWorker {
 public:
  GetCPUWorker(Nan::Callback* callback, v8::Local<v8::Array> &processes);
  ~GetCPUWorker();

  void Execute();
  void HandleOKCallback();
 private:
  Cpu* cpu_info;
  uint32_t process_count;
};

#endif  // SRC_WORKER_H_
