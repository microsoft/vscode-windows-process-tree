{
  "targets": [
    {
      "target_name": "windows_process_tree",
      "sources": [
        "src/addon.cc",
        "src/process.cc"
      ],
      "include_dirs": [
        "<!(node -e \"require('nan')\")"
      ]
    }
  ]
}
