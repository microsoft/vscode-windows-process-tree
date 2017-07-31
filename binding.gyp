{
    "targets": [
      {
        "target_name": "windows_process_tree",
        "sources": [ "addon.cc" ],
        "include_dirs": [
          "<!(node -e \"require('nan')\")"
        ],
        'libraries': [
          'psapi.lib'
        ]
      }
    ]
  }