/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_CPU_WORKER_H
#define SRC_CPU_WORKER_H

#include <nan.h>
#include "process.h"

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

#endif  // SRC_CPU_WORKER_H
