/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include <nan.h>
#include "process.h"
#include "worker.h"

void GetProcessList(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  ProcessInfo process_info[1024];
  uint32_t process_count;
  
  Nan::Callback *callback = new Nan::Callback(v8::Local<v8::Function>::Cast(info[0]));
  Worker *worker = new Worker(process_info, &process_count, callback);
  Nan::AsyncQueueWorker(worker);
}

void Init(v8::Local<v8::Object> exports) {
  exports->Set(Nan::New("getProcessList").ToLocalChecked(),
               Nan::New<v8::FunctionTemplate>(GetProcessList)->GetFunction());
}

NODE_MODULE(hello, Init)
