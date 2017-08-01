#include <nan.h>
#include <psapi.h>
#include <tlhelp32.h>

DWORD GetParentPID(DWORD pid) {
  HANDLE h = NULL;
  PROCESSENTRY32 pe = { 0 };
  DWORD ppid = 0;
  pe.dwSize = sizeof(PROCESSENTRY32);
  h = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (Process32First(h, &pe)) {
    do {
      if (pe.th32ProcessID == pid) {
        ppid = pe.th32ParentProcessID;
        break;
      }
    } while (Process32Next(h, &pe));
  }
  CloseHandle(h);
  return (ppid);
}

void Method(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  DWORD aProcesses[1024];
  DWORD cbNeeded;
  DWORD cProcesses;
  unsigned int i;

  if (!EnumProcesses(aProcesses, sizeof(aProcesses), &cbNeeded)) {
    info.GetReturnValue().SetUndefined();
    return;
  }

  v8::Local<v8::Array> a = Nan::New<v8::Array>(cProcesses);

  cProcesses = cbNeeded / sizeof(DWORD);

  unsigned int arrayIndex = 0;

  for (i = 0; i < cProcesses; i++) {
    if (aProcesses[i] != 0) {
      TCHAR szProcessName[MAX_PATH] = TEXT("<unknown>");
      
      // Get a handle to the process.
      HANDLE hProcess = OpenProcess(
          PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, aProcesses[i]);
  
      // Get the process name.
      if (hProcess != NULL) {
        HMODULE hMod;
        DWORD cbNeeded;

        if (EnumProcessModules(hProcess, &hMod, sizeof(hMod), &cbNeeded)) {
          GetModuleBaseName(hProcess, hMod, szProcessName, 
                            sizeof(szProcessName)/sizeof(TCHAR));
          
          // Get the process information
          v8::Local<v8::String> processName = Nan::New<v8::String>(szProcessName).ToLocalChecked();
          v8::Local<v8::Number> processId = Nan::New<v8::Number>(aProcesses[i]);
          v8::Local<v8::Number> parentProcessId = Nan::New<v8::Number>(GetParentPID(aProcesses[i]));

          // Construct the return object
          v8::Local<v8::Object> object = Nan::New<v8::Object>();
          Nan::Set(object, Nan::New<v8::String>("name").ToLocalChecked(), processName);
          Nan::Set(object, Nan::New<v8::String>("pid").ToLocalChecked(), processId);
          Nan::Set(object, Nan::New<v8::String>("ppid").ToLocalChecked(), parentProcessId);

          // Set the return object on the array
          Nan::Set(a, arrayIndex++, Nan::New<v8::Value>(object));
        }
      }

      // Release the handle to the process.
      CloseHandle(hProcess);
    }
  }
  
  info.GetReturnValue().Set(a);
}

void Init(v8::Local<v8::Object> exports) {
  exports->Set(Nan::New("hello").ToLocalChecked(),
               Nan::New<v8::FunctionTemplate>(Method)->GetFunction());
}

NODE_MODULE(hello, Init)