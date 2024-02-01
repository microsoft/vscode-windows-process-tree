/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#ifndef SRC_PROCESS_WORKER_H
#define SRC_PROCESS_WORKER_H

#include <napi.h>
#include "process.h"

class GetProcessesWorker : public Napi::AsyncWorker {
 public:
  GetProcessesWorker(Napi::Function& callback,
                     DWORD process_data_flags);
  ~GetProcessesWorker();

  void Execute() override;
  void OnOK() override;

 private:
  std::vector<ProcessInfo> process_info_;
  uint32_t process_count_ = 0;
  DWORD process_data_flags_;
};

#endif  // SRC_PROCESS_WORKER_H
