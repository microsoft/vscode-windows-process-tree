{
  "targets": [
    {
      "target_name": "windows_process_tree",
      "dependencies": [
        "<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except",
      ],
      "conditions": [
        ['OS=="win"', {
          "sources": [
            "src/addon.cc",
            "src/cpu_worker.cc",
            "src/process.cc",
            "src/process_worker.cc",
            "src/process_commandline.cc"
          ],
          "include_dirs": [],
          "libraries": [ 'psapi.lib' ],
          "msvs_configuration_attributes": {
            "SpectreMitigation": "Spectre"
          },
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": [
                "/guard:cf",
                "/w34244",
                "/we4267",
                "/ZH:SHA_256"
              ]
            },
            "VCLinkerTool": {
              "AdditionalOptions": [
                "/guard:cf"
              ]
            }
          }
        }]
      ]
    }
  ]
}
