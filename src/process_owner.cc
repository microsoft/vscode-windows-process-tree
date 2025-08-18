/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#include "process_owner.h"

#include <windows.h>
#include <sddl.h>
#include <vector>

static inline bool WideToMultiByteACP(const wchar_t* w, int wlen, std::string& out) {
  out.clear();
  if (!w || wlen <= 0) return false;
  const int bytes = ::WideCharToMultiByte(CP_ACP, 0, w, wlen, nullptr, 0, nullptr, nullptr);
  if (bytes <= 0) return false;
  out.resize(bytes);
  return ::WideCharToMultiByte(CP_ACP, 0, w, wlen, out.data(), bytes, nullptr, nullptr) == bytes;
}

bool GetProcessOwner(ProcessInfo& process_info) {
  process_info.owner.clear();

  HANDLE hProcess = ::OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_info.pid);
  if (!hProcess) return false;

  HANDLE hToken = nullptr;
  if (!::OpenProcessToken(hProcess, TOKEN_QUERY, &hToken)) {
    ::CloseHandle(hProcess);
    return false;
  }

  DWORD len = 0;
  ::GetTokenInformation(hToken, TokenUser, nullptr, 0, &len);
  if (!len) { ::CloseHandle(hToken); ::CloseHandle(hProcess); return false; }

  std::vector<BYTE> buf(len);
  if (!::GetTokenInformation(hToken, TokenUser, buf.data(), len, &len)) {
    ::CloseHandle(hToken); ::CloseHandle(hProcess);
    return false;
  }
  const TOKEN_USER* tu = reinterpret_cast<const TOKEN_USER*>(buf.data());

  DWORD nameLen = 0, domLen = 0; SID_NAME_USE use;
  ::LookupAccountSidW(nullptr, tu->User.Sid, nullptr, &nameLen, nullptr, &domLen, &use);

  std::wstring name(nameLen, L'\0');
  std::wstring domain(domLen, L'\0');
  if (::LookupAccountSidW(nullptr, tu->User.Sid, name.data(), &nameLen, domain.data(), &domLen, &use)) {
    name.resize(nameLen);
    domain.resize(domLen);
    std::wstring domUser;
    domUser.reserve(domain.size() + 1 + name.size());
    domUser.append(domain).append(L"\\").append(name);

    const int wlen = static_cast<int>(domUser.size());
    (void)WideToMultiByteACP(domUser.c_str(), wlen, process_info.owner);

    ::CloseHandle(hToken);
    ::CloseHandle(hProcess);
    return !process_info.owner.empty();
  }

  LPWSTR sidStr = nullptr;
  if (::ConvertSidToStringSidW(tu->User.Sid, &sidStr) && sidStr) {
    const int wlen = static_cast<int>(::lstrlenW(sidStr));
    (void)WideToMultiByteACP(sidStr, wlen, process_info.owner);
    ::LocalFree(sidStr);
  }

  ::CloseHandle(hToken);
  ::CloseHandle(hProcess);
  return !process_info.owner.empty();
}
