/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "cpu_worker.h"
#include <cmath>

GetCPUWorker::GetCPUWorker(
  Nan::Callback* callback,
  v8::Local<v8::Array> &processes)
      : AsyncWorker(callback) {
  // Processes is persisted so it can be copied out, but the value is not accessible
  // within Execute, so copy all pids into cpu info object
  SaveToPersistent("processes", processes);
  process_count = processes->Length();
  cpu_info = new Cpu[process_count];

  for (uint32_t i = 0; i < process_count; i++) {
    v8::Local<v8::Object> process = processes->Get(Nan::New<v8::Integer>(i))->ToObject();
    DWORD pid = (DWORD)(process->Get(Nan::New("pid").ToLocalChecked()))->NumberValue();
    cpu_info[i].pid = pid;
  }
}

GetCPUWorker::~GetCPUWorker() {
  delete[] cpu_info;
}

void GetCPUWorker::Execute() {
// Take first sample of counters
  for (uint32_t i = 0; i < process_count; i++) {
    GetCpuUsage(cpu_info, &i, true);
  }

  // Sleep for one second
  Sleep(1000);

  // Sample counters again and complete CPU usage calculation
  for (uint32_t i = 0; i < process_count; i++) {
    GetCpuUsage(cpu_info, &i, false);
  }
}

void GetCPUWorker::HandleOKCallback() {
  Nan::HandleScope scope;
  v8::Local<v8::Array> process_array = v8::Local<v8::Array>::Cast(GetFromPersistent("processes"));
  uint32_t count = process_array->Length();
  // Transfer results into actual result object
  v8::Local<v8::Array> result = Nan::New<v8::Array>(count);
  for (uint32_t i = 0; i < count; i++) {
    v8::Local<v8::Object> object = process_array->Get(Nan::New<v8::Integer>(i))->ToObject();

    if (!std::isnan(cpu_info[i].cpu)) {
      Nan::Set(object, Nan::New<v8::String>("cpu").ToLocalChecked(),
                Nan::New<v8::Number>(cpu_info[i].cpu));
    }

    Nan::Set(result, i, Nan::New<v8::Value>(object));
  }

  v8::Local<v8::Value> argv[] = { result };
  Nan::AsyncResource resource("windows-process-tree:addon.HandleOKCallback");
  callback->Call(1, argv, &resource);
}
