/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "cpu_worker.h"
#include <cmath>

GetCPUWorker::GetCPUWorker(
    Napi::Function& callback,
    Napi::Array& processes)
    : AsyncWorker(callback, "windows-process-tree:cpuworker.OnOK") {
  for (uint32_t i = 0; i < processes.Length(); i++) {
    Cpu cpu_info;
    Napi::Object process = processes.Get(i).As<Napi::Object>();
    if (process.Has("pid")) {
      Napi::Value pid = process.Get("pid");
      cpu_info.pid = static_cast<DWORD>(pid.As<Napi::Number>().Int32Value());
    }
    cpu_info_.push_back(std::move(cpu_info));
  }
  process_count_ = processes.Length();
  // Processes is persisted so it can be copied out, but the value is not accessible
  // within Execute, so copy all pids into cpu info object
  processes_ref_ = Napi::Persistent(processes);
}

GetCPUWorker::~GetCPUWorker() = default;

void GetCPUWorker::Execute() {
// Take first sample of counters
  for (uint32_t i = 0; i < process_count_; i++) {
    GetCpuUsage(cpu_info_[i], true);
  }

  // Sleep for one second
  Sleep(1000);

  // Sample counters again and complete CPU usage calculation
  for (uint32_t i = 0; i < process_count_; i++) {
    GetCpuUsage(cpu_info_[i], false);
  }
}

void GetCPUWorker::OnOK() {
  Napi::HandleScope scope(Env());
  Napi::Env env = Env();
  Napi::Array processes = processes_ref_.Value();
  // Transfer results into actual result object
  Napi::Array result = Napi::Array::New(env, processes.Length());
  for (uint32_t i = 0; i < processes.Length(); i++) {
    Cpu cpu_info = cpu_info_[i];
    Napi::Object process = processes.Get(i).As<Napi::Object>();
    if (!std::isnan(cpu_info.cpu)) {
      process.Set("cpu",
                 Napi::Number::New(env, cpu_info.cpu));
    }

    result.Set(i, process);
  }

  Callback().Call({result});
}
