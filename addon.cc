#include <nan.h>
#include <psapi.h>
#include <tlhelp32.h>

DWORD GetParentPID(DWORD pid) {
  PROCESSENTRY32 process_entry = { 0 };
  DWORD parent_pid = 0;
  HANDLE handle = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  process_entry.dwSize = sizeof(PROCESSENTRY32);
  if (Process32First(handle, &process_entry)) {
    do {
      if (process_entry.th32ProcessID == pid) {
        parent_pid = process_entry.th32ParentProcessID;
        break;
      }
    } while (Process32Next(handle, &process_entry));
  }
  CloseHandle(handle);
  return parent_pid;
}

void GetProcessList(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  DWORD process_ids[1024];
  DWORD process_ids_size;

  if (!EnumProcesses(process_ids, sizeof(process_ids), &process_ids_size)) {
    info.GetReturnValue().SetUndefined();
    return;
  }

  DWORD process_ids_count = process_ids_size / sizeof(DWORD);

  v8::Local<v8::Array> a = Nan::New<v8::Array>(process_ids_count);

  unsigned int arrayIndex = 0;

  for (unsigned int i = 0; i < process_ids_count; i++) {
    if (process_ids[i] != 0) {
      TCHAR process_name[MAX_PATH] = TEXT("<unknown>");
      
      // Get a handle to the process.
      HANDLE process_handle = OpenProcess(
          PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, process_ids[i]);
  
      // Get the process name.
      if (process_handle != NULL) {
        HMODULE modules;
        DWORD modules_size;

        if (EnumProcessModules(process_handle, &modules, sizeof(modules),
                               &modules_size)) {
          GetModuleBaseName(process_handle, modules, process_name, 
                            sizeof(process_name) / sizeof(TCHAR));

          // Construct the return object
          v8::Local<v8::Object> object = Nan::New<v8::Object>();
          Nan::Set(object, Nan::New<v8::String>("name").ToLocalChecked(),
                   Nan::New<v8::String>(process_name).ToLocalChecked());
          Nan::Set(object, Nan::New<v8::String>("pid").ToLocalChecked(),
                   Nan::New<v8::Number>(process_ids[i]));
          Nan::Set(object, Nan::New<v8::String>("ppid").ToLocalChecked(),
                   Nan::New<v8::Number>(GetParentPID(process_ids[i])));

          // Set the return object on the array
          Nan::Set(a, arrayIndex++, Nan::New<v8::Value>(object));
        }
      }

      // Release the handle to the process.
      CloseHandle(process_handle);
    }
  }
  
  info.GetReturnValue().Set(a);
}

void Init(v8::Local<v8::Object> exports) {
  exports->Set(Nan::New("getProcessList").ToLocalChecked(),
               Nan::New<v8::FunctionTemplate>(GetProcessList)->GetFunction());
}

NODE_MODULE(hello, Init)