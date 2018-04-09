/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include <nan.h>
#include "process.h"
#include "worker.h"
#include <cmath>

void GetProcessList(const Nan::FunctionCallbackInfo<v8::Value>& args) {
  if (args.Length() < 2) {
    Nan::ThrowTypeError("GetProcessList expects two arguments.");
    return;
  }

  if (!args[0]->IsFunction()) {
    Nan::ThrowTypeError("The first argument of GetProcessList, callback, must be a function.");
    return;
  }

  if (!args[1]->IsNumber()) {
    Nan::ThrowTypeError("The second argument of GetProcessList, flags, must be a number.");
    return;
  }

  Nan::Callback *callback = new Nan::Callback(v8::Local<v8::Function>::Cast(args[0]));
  DWORD* flags = new DWORD;
  *flags = (DWORD)args[1]->NumberValue();
  Worker *worker = new Worker(callback, flags);
  Nan::AsyncQueueWorker(worker);
}

void GetProcessCpuUsage(const Nan::FunctionCallbackInfo<v8::Value>& args) {
  if (args.Length() < 2) {
      Nan::ThrowTypeError("GetProcessCpuUsage expects two arguments.");
      return;
  }

  if (!args[0]->IsArray()) {
    Nan::ThrowTypeError("The first argument of GetProcessCpuUsage, callback, must be an array.");
    return;
  }

  if (!args[1]->IsFunction()) {
    Nan::ThrowTypeError("The second argument of GetProcessCpuUsage, flags, must be a function.");
    return;
  }

  // Read the ProcessTreeNode JS object
  v8::Local<v8::Array> processes = v8::Local<v8::Array>::Cast(args[0]);
  uint32_t count = processes->Length();
  Cpu* cpu_info = new Cpu[count];

  // Read pid from each array and populate data structure to calculate CPU, take first sample of counters
  for (uint32_t i = 0; i < count; i++) {
    v8::Local<v8::Object> process = processes->Get(Nan::New<v8::Integer>(i))->ToObject();
    DWORD pid = (DWORD)(process->Get(Nan::New("pid").ToLocalChecked()))->NumberValue();
    cpu_info[i].pid = pid;
    GetCpuUsage(cpu_info, &i, true);
  }

  // Sleep for one second
  Sleep(1000);

  // Sample counters again and complete CPU usage calculation
  for (uint32_t i = 0; i < count; i++) {
    GetCpuUsage(cpu_info, &i, false);
  }

  Nan::Callback *callback = new Nan::Callback(v8::Local<v8::Function>::Cast(args[1]));

  v8::Local<v8::Array> result = Nan::New<v8::Array>(count);
  for (uint32_t i = 0; i < count; i++) {
    v8::Local<v8::Object> object = processes->Get(Nan::New<v8::Integer>(i))->ToObject();

    if (!std::isnan(cpu_info[i].cpu)) {
      Nan::Set(object, Nan::New<v8::String>("cpu").ToLocalChecked(),
                Nan::New<v8::Number>(cpu_info[i].cpu));
    }

    Nan::Set(result, i, Nan::New<v8::Value>(object));
  }

  v8::Local<v8::Value> argv[] = { result };
  callback->Call(1, argv);
}

void Init(v8::Local<v8::Object> exports) {
  exports->Set(Nan::New("getProcessList").ToLocalChecked(),
               Nan::New<v8::FunctionTemplate>(GetProcessList)->GetFunction());
  exports->Set(Nan::New("getProcessCpuUsage").ToLocalChecked(),
               Nan::New<v8::FunctionTemplate>(GetProcessCpuUsage)->GetFunction());
}

NODE_MODULE(hello, Init)
