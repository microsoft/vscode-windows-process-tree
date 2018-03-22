{
  "targets": [
    {
      "target_name": "windows_process_tree",
      "sources": [
        "src/addon.cc",
        "src/process.cc",
        "src/worker.cc",
        "src/process_arguments.cc"
      ],
      "include_dirs": [
        "<!(node -e \"require('nan')\")"
      ],
      "libraries": [ 'psapi.lib' ]
    }
  ]
}
