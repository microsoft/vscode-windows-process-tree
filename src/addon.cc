/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include <nan.h>
#include "process.h"
#include "worker.h"

void GetProcessList(const Nan::FunctionCallbackInfo<v8::Value>& args) {
  ProcessInfo process_info[1024];
  uint32_t process_count;

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
  DWORD flags = (DWORD)args[1]->NumberValue();
  Worker *worker = new Worker(process_info, &process_count, callback, &flags);
  Nan::AsyncQueueWorker(worker);
}

void Init(v8::Local<v8::Object> exports) {
  exports->Set(Nan::New("getProcessList").ToLocalChecked(),
               Nan::New<v8::FunctionTemplate>(GetProcessList)->GetFunction());
}

NODE_MODULE(hello, Init)
