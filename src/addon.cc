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
  GetProcessesWorker *worker = new GetProcessesWorker(callback, flags);
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
  Nan::Callback *callback = new Nan::Callback(v8::Local<v8::Function>::Cast(args[1]));
  GetCPUWorker *worker = new GetCPUWorker(callback, processes);
  Nan::AsyncQueueWorker(worker);
}

void Init(v8::Local<v8::Object> exports) {
  exports->Set(Nan::New("getProcessList").ToLocalChecked(),
               Nan::New<v8::FunctionTemplate>(GetProcessList)->GetFunction());
  exports->Set(Nan::New("getProcessCpuUsage").ToLocalChecked(),
               Nan::New<v8::FunctionTemplate>(GetProcessCpuUsage)->GetFunction());
}

NODE_MODULE(hello, Init)
