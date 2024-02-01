/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include <napi.h>
#include "cpu_worker.h"
#include "process_worker.h"

void GetProcessList(const Napi::CallbackInfo& args) {
  Napi::Env env(args.Env());

  if (args.Length() < 2) {
    throw Napi::TypeError::New(env, "GetProcessList expects two arguments.");
  }

  if (!args[0].IsFunction()) {
    throw Napi::TypeError::New(env, "The first argument of GetProcessList, callback, must be a function.");
  }

  if (!args[1].IsNumber()) {
    throw Napi::TypeError::New(env, "The second argument of GetProcessList, flags, must be a number.");
  }

  Napi::Function callback = args[0].As<Napi::Function>();
  DWORD flags = static_cast<DWORD>(args[1].As<Napi::Number>().Int32Value());
  auto* worker = new GetProcessesWorker(callback, flags);
  worker->Queue();
}

void GetProcessCpuUsage(const Napi::CallbackInfo& args) {
  Napi::Env env(args.Env());

  if (args.Length() < 2) {
    throw Napi::TypeError::New(env, "GetProcessCpuUsage expects two arguments.");
  }

  if (!args[0].IsArray()) {
    throw Napi::TypeError::New(env, "The first argument of GetProcessCpuUsage, processList, must be an array.");
  }

  if (!args[1].IsFunction()) {
    throw Napi::TypeError::New(env, "The second argument of GetProcessCpuUsage, callback, must be a function.");
  }

  // Read the ProcessTreeNode JS object
  Napi::Array processes = args[0].As<Napi::Array>();
  Napi::Function callback = args[1].As<Napi::Function>();
  auto* worker = new GetCPUWorker(callback, processes);
  worker->Queue();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("getProcessList", Napi::Function::New(env, GetProcessList));
  exports.Set("getProcessCpuUsage", Napi::Function::New(env, GetProcessCpuUsage));
  return exports;
}

NODE_API_MODULE(WindowsProcessTree, Init)
