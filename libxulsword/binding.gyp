{
  "targets": [
    {
      "toolset": "host",
      "target_name": "libxulsword",
      "sources": [ "src/libxulsword.cpp" ],
      "libraries": ["$(XULSWORD)/Cpp/install/so/libxulsword-static.so"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "$(XULSWORD)/Cpp/src/include",
        "$(XULSWORD)/Cpp/sword/include"
      ],
      'defines': [ 'NODE_GYP_MODULE_NAME=libxulsword' ],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
    },
    {
      "toolset": "target",
      "target_name": "libxulsword",
      "sources": [ "src/libxulsword.cpp" ],
      "libraries": [
        "$(XULSWORD)/Cpp/install.32win/dll/libxulsword-static.dll"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "$(XULSWORD)/Cpp/src/include",
        "$(XULSWORD)/Cpp/sword/include"
      ],
      'defines': [ 'NODE_GYP_MODULE_NAME=libxulsword' ],
      'cflags!': [ '-m64', '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'cflags': [ '-m32', '--sysroot=$(GYP_SYSROOT)' ],
      'ldflags!': [ '-m64', '-rdynamic' ],
      'ldflags': [ '-m32' ],
    }
  ],
  'variables' : {
    'openssl_fips': ''
  },

}
