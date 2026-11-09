/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include <napi.h>
#include <windows.h>
#include <aclapi.h>
#include <sddl.h>
#include <memory>
#include "cpu_worker.h"
#include "process_worker.h"

std::wstring CurrentProcessUserSid(Napi::Env env) {
  HANDLE rawToken = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &rawToken)) {
    throw Napi::Error::New(env, "OpenProcessToken failed: " + std::to_string(GetLastError()));
  }
  std::unique_ptr<void, decltype(&CloseHandle)> token(rawToken, &CloseHandle);

  struct {
    TOKEN_USER user;
    BYTE sid[SECURITY_MAX_SID_SIZE];
  } tokenUser = {};
  DWORD returnedLength = 0;
  if (!GetTokenInformation(token.get(), TokenUser, &tokenUser, sizeof(tokenUser), &returnedLength)) {
    throw Napi::Error::New(env, "GetTokenInformation failed: " + std::to_string(GetLastError()));
  }

  LPWSTR rawSid = nullptr;
  if (!ConvertSidToStringSidW(tokenUser.user.User.Sid, &rawSid)) {
    throw Napi::Error::New(env, "ConvertSidToStringSidW failed: " + std::to_string(GetLastError()));
  }
  std::unique_ptr<void, decltype(&LocalFree)> sid(rawSid, &LocalFree);
  return std::wstring(rawSid);
}

Napi::Value GetCurrentProcessUserSid(const Napi::CallbackInfo& args) {
  const auto sid = CurrentProcessUserSid(args.Env());
  return Napi::String::New(args.Env(), reinterpret_cast<const char16_t*>(sid.c_str()));
}

class SetOwnerOnlyAclWorker : public Napi::AsyncWorker {
 public:
  SetOwnerOnlyAclWorker(Napi::Env env, std::wstring path)
      : Napi::AsyncWorker(env),
        deferred_(Napi::Promise::Deferred::New(env)),
        path_(std::move(path)),
        sddl_(L"D:P(A;OICI;FA;;;" + CurrentProcessUserSid(env) + L")(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)") {}

  Napi::Promise Promise() { return deferred_.Promise(); }

  void Execute() override {
    PSECURITY_DESCRIPTOR rawDescriptor = nullptr;
    if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl_.c_str(), SDDL_REVISION_1, &rawDescriptor, nullptr)) {
      SetError("ConvertStringSecurityDescriptorToSecurityDescriptorW failed: " + std::to_string(GetLastError()));
      return;
    }
    std::unique_ptr<void, decltype(&LocalFree)> descriptor(rawDescriptor, &LocalFree);

    PACL dacl = nullptr;
    BOOL present = FALSE;
    BOOL defaulted = FALSE;
    if (!GetSecurityDescriptorDacl(descriptor.get(), &present, &dacl, &defaulted)) {
      SetError("GetSecurityDescriptorDacl failed: " + std::to_string(GetLastError()));
      return;
    }
    if (!present || !dacl) {
      SetError("Owner-only security descriptor has no DACL.");
      return;
    }

    const DWORD result = SetNamedSecurityInfoW(
        &path_[0], SE_FILE_OBJECT,
        DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
        nullptr, nullptr, dacl, nullptr);
    if (result != ERROR_SUCCESS) {
      SetError("SetNamedSecurityInfoW failed: " + std::to_string(result));
    }
  }

  void OnOK() override { deferred_.Resolve(Env().Undefined()); }
  void OnError(const Napi::Error& error) override { deferred_.Reject(error.Value()); }

 private:
  Napi::Promise::Deferred deferred_;
  std::wstring path_;
  std::wstring sddl_;
};

Napi::Value SetOwnerOnlyAcl(const Napi::CallbackInfo& args) {
  const auto env = args.Env();
  if (args.Length() != 1 || !args[0].IsString()) {
    throw Napi::TypeError::New(env, "SetOwnerOnlyAcl expects a path string.");
  }
  const auto path = args[0].As<Napi::String>().Utf16Value();
  if (path.empty() || path.find(u'\0') != std::u16string::npos) {
    throw Napi::TypeError::New(env, "SetOwnerOnlyAcl expects a non-empty path without null characters.");
  }
  auto* worker = new SetOwnerOnlyAclWorker(env, std::wstring(path.begin(), path.end()));
  const auto promise = worker->Promise();
  worker->Queue();
  return promise;
}

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
  exports.Set("getCurrentProcessUserSid", Napi::Function::New(env, GetCurrentProcessUserSid));
  exports.Set("setOwnerOnlyAcl", Napi::Function::New(env, SetOwnerOnlyAcl));
  exports.Set("getProcessList", Napi::Function::New(env, GetProcessList));
  exports.Set("getProcessCpuUsage", Napi::Function::New(env, GetProcessCpuUsage));
  return exports;
}

NODE_API_MODULE(WindowsProcessTree, Init)
