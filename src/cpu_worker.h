/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_CPU_WORKER_H
#define SRC_CPU_WORKER_H

#include <napi.h>
#include "process.h"

class GetCPUWorker : public Napi::AsyncWorker {
 public:
  GetCPUWorker(Napi::Function& callback,
               Napi::Array& processes);
  ~GetCPUWorker();

  void Execute() override;
  void OnOK() override;

 private:
  Napi::Reference<Napi::Array> processes_ref_;
  std::vector<Cpu> cpu_info_;
  uint32_t process_count_;
};

#endif  // SRC_CPU_WORKER_H
