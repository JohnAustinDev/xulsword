{
  "targets": [
    {
      "target_name": "libsword_napi",
      "sources": [ "src/libsword_napi.cpp" ],
      "libraries": ["/home/tomr/Documents/Projects/xulsword/Cpp/build/libxulsword.so.1.4.4"],
      # "libraries": ["/home/tomr/Documents/Projects/xulsword/build-files/xulsword/development/xulsword/libxulsword-1.4.5-Linux_x86_64-gcc3.so"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "../Cpp/src/include",
        "../Cpp/sword/include"
      ],
      'defines': [ 'NODE_GYP_MODULE_NAME=libsword_napi' ],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'conditions': [
        ["OS=='win'", {
            "defines": [
                "_HAS_EXCEPTIONS=1"
            ],
            "msvs_settings": {
                "VCCLCompilerTool": {
                    "ExceptionHandling": 1
                },
            },
        }],
        ["OS=='mac'", {
            'xcode_settings': {
            'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
            'CLANG_CXX_LIBRARY': 'libc++',
            'MACOSX_DEPLOYMENT_TARGET': '10.7',
            },
        }],
    ]
    }
  ]
}