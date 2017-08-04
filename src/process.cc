#include "process.h"

#include <psapi.h>
#include <string.h>
#include <tlhelp32.h>

void GetRawProcessList(ProcessInfo process_info[1024], uint32_t* process_count) {
  *process_count = 0;

  // Fetch the PID and PPIDs
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
            (*process_count)++;
          }
        }

        // Release the handle to the process.
        CloseHandle(process_handle);
      }
    } while (Process32Next(snapshot_handle, &process_entry));
  }
  CloseHandle(snapshot_handle);
}
