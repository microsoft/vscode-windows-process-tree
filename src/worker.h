/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_WORKER_H_
#define SRC_WORKER_H_

#include <nan.h>
#include "process.h"

class Worker : public Nan::AsyncWorker {
 public:
  Worker(ProcessInfo* process_info, uint32_t* process_count, 
      Nan::Callback* callback, DWORD* process_data_flags);
  ~Worker();

  void Execute();
  void HandleOKCallback();
 private:
  ProcessInfo *process_info;
  uint32_t* process_count;
  DWORD* process_data_flags;
};

#endif  // SRC_WORKER_H_
