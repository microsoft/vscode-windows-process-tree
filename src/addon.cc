#include <unordered_map>
#include <nan.h>
#include <psapi.h>
#include <string.h>
#include <tlhelp32.h>

struct ProcessInfo {
  TCHAR name[MAX_PATH];
  DWORD pid;
  DWORD ppid;
};

void GetRawProcessList(ProcessInfo process_info[1024], uint32_t* process_count) {
  *process_count = 0;

  // Fetch the parent IDs and store in a map for fast lookup, because
  // CreateToolhelp32Snapshot is a costly operation we only want to do it once.
  std::unordered_map<DWORD, DWORD> pid_to_ppid_map;
  PROCESSENTRY32 process_entry = { 0 };
  DWORD parent_pid = 0;
  HANDLE snapshot_handle = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  process_entry.dwSize = sizeof(PROCESSENTRY32);
  if (Process32First(snapshot_handle, &process_entry)) {
    do {
      if (process_entry.th32ProcessID != 0) {
        // Get a handle to the process.
        HANDLE process_handle = OpenProcess(
            PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, process_entry.th32ProcessID);

        if (process_handle != NULL) {
          HMODULE modules;
          DWORD modules_size;

          // Get the process name and store it and the pid for later
          if (EnumProcessModules(process_handle, &modules, sizeof(modules),
                                &modules_size)) {
            TCHAR process_name[MAX_PATH] = TEXT("<unknown>");
            GetModuleBaseName(process_handle, modules, process_name,
                              sizeof(process_name) / sizeof(TCHAR));

            process_info[*process_count].pid = process_entry.th32ProcessID;
            process_info[*process_count].ppid = process_entry.th32ParentProcessID;
            strcpy(process_info[*process_count].name, process_name);
            *process_count++;
          }
        }

        // Release the handle to the process.
        CloseHandle(process_handle);
      }
    } while (Process32Next(snapshot_handle, &process_entry));
  }
  CloseHandle(snapshot_handle);
}

void GetProcessList(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  Nan::HandleScope scope;

  ProcessInfo process_info[1024];
  uint32_t process_count;

  GetRawProcessList(process_info, &process_count);

  // Transfer results into actual result object
  v8::Local<v8::Array> result = Nan::New<v8::Array>(process_count);
  for (unsigned int i = 0; i < process_count; i++) {
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
