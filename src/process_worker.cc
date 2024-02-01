/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "process_worker.h"

GetProcessesWorker::GetProcessesWorker(
    Napi::Function& callback,
    DWORD process_data_flags) 
    : Napi::AsyncWorker(callback, "windows-process-tree:addon.HandleOKCallback"),
      process_data_flags_(process_data_flags) {}

GetProcessesWorker::~GetProcessesWorker() = default;

void GetProcessesWorker::Execute() {
  process_count_ = GetRawProcessList(process_info_, process_data_flags_);
}

void GetProcessesWorker::OnOK() {
  Napi::HandleScope scope(Env());
  Napi::Env env = Env();
  // Transfer results into actual result object
  Napi::Array result = Napi::Array::New(env, process_count_);
  for (uint32_t i = 0; i < process_count_; i++) {
    const ProcessInfo& pinfo = process_info_[i];
    Napi::Object object = Napi::Object::New(env);
    object.Set("name",
               Napi::String::New(env, pinfo.name));
    object.Set("pid",
               Napi::Number::New(env, pinfo.pid));
    object.Set("ppid",
               Napi::Number::New(env, pinfo.ppid));

    // Property should be undefined when memory flag isn't set
    if (MEMORY & process_data_flags_) {
      object.Set("memory",
                 Napi::Number::New(env, pinfo.memory));
    }

    if (COMMANDLINE & process_data_flags_) {
      object.Set("commandLine",
          Napi::String::New(env, pinfo.commandLine));
    }

    result.Set(i, object);
  }

  Callback().Call({result});
}
