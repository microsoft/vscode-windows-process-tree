{
  "targets": [
    {
      "target_name": "windows_process_tree",
      "sources": [
        "src/addon.cc",
        "src/cpu_worker.cc",
        "src/process.cc",
        "src/process_worker.cc",
        "src/process_commandline.cc"
      ],
      "include_dirs": [
        "<!(node -e \"require('nan')\")"
      ],
      "libraries": [ 'psapi.lib' ],
      'msvs_settings': {
        'VCCLCompilerTool': {
          'AdditionalOptions': [
            '/Qspectre',
            '/guard:cf'
          ]
        },
        'VCLinkerTool': {
          'AdditionalOptions': [
            '/guard:cf'
          ]
        }
      }
    }
  ]
}
