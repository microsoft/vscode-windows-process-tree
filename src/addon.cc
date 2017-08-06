/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include <nan.h>

#include "process.h"

void GetProcessList(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  Nan::HandleScope scope;

  ProcessInfo process_info[1024];
  uint32_t process_count;

  GetRawProcessList(process_info, &process_count);

  // Transfer results into actual result object
  v8::Local<v8::Array> result = Nan::New<v8::Array>(process_count);
  for (uint32_t i = 0; i < process_count; i++) {
    v8::Local<v8::Object> object = Nan::New<v8::Object>();
    Nan::Set(object, Nan::New<v8::String>("name").ToLocalChecked(),
             Nan::New<v8::String>(process_info[i].name).ToLocalChecked());
    Nan::Set(object, Nan::New<v8::String>("pid").ToLocalChecked(),
             Nan::New<v8::Number>(process_info[i].pid));
    Nan::Set(object, Nan::New<v8::String>("ppid").ToLocalChecked(),
             Nan::New<v8::Number>(process_info[i].ppid));

    Nan::Set(result, i, Nan::New<v8::Value>(object));
  }
  info.GetReturnValue().Set(result);
}

void Init(v8::Local<v8::Object> exports) {
  exports->Set(Nan::New("getProcessList").ToLocalChecked(),
               Nan::New<v8::FunctionTemplate>(GetProcessList)->GetFunction());
}

NODE_MODULE(hello, Init)
