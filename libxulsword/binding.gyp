{
  'targets': [
    {
      'toolset': 'host',
      'target_name': 'libxulsword',
      'sources': [ 'src/libxulsword.cpp' ],
      'libraries': ["$(XULSWORD)/Cpp/install/so/libxulsword-static.so"],
      'include_dirs': [
        "<!@(node -p \"require('node-addon-api').include\")",
        "$(XULSWORD)/Cpp/src/include",
        "$(XULSWORD)/Cpp/sword/include"
      ],
      'defines': [ 'NODE_GYP_MODULE_NAME=libxulsword' ],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
    },
    {
      'toolset': 'target',
      'target_name': 'libxulsword',
      'sources': [ 'src/libxulsword.cpp' ],
      'libraries': [
        "$(XULSWORD)/Cpp/install.$(XCWD)/dll/libxulsword-static.dll"
      ],
      'include_dirs': [
        "<!@(node -p \"require('node-addon-api').include\")",
        "$(XULSWORD)/Cpp/src/include",
        "$(XULSWORD)/Cpp/sword/include"
      ],
      'conditions': [['"$(XCWD)"=="32win"', {
        'cflags!': [ '-m64', '-fno-exceptions' ],
        'ldflags!': [ '-m64', '-rdynamic' ],
        'cflags_cc!': [ '-m64', '-fno-exceptions' ],
        'cflags': [ '-m32', '--sysroot=$(GYP_SYSROOT)' ],
        'ldflags': [ '-m32' ],
      }, {
        'cflags!': [ '-m32', '-fno-exceptions' ],
        'ldflags!': [ '-m32', '-rdynamic' ],
        'cflags_cc!': [ '-m32', '-fno-exceptions' ],
        'cflags': [ '-m64', '--sysroot=$(GYP_SYSROOT)' ],
        'ldflags': [ '-m64' ],
      }]],
      'defines': [ 'NODE_GYP_MODULE_NAME=libxulsword' ],
      'copies': [
        {
          'files': [
            "$(XULSWORD)/Cpp/install.$(XCWD)/dll/libstdc++-6.dll",
            "$(XULSWORD)/Cpp/install.$(XCWD)/dll/libwinpthread-1.dll"
          ],
          'destination': 'build/Release'
        },
        {
          'conditions': [['"$(XCWD)"=="32win"',
            {
              'files': [
              "$(XULSWORD)/Cpp/install.32win/dll/libgcc_s_sjlj-1.dll",
            ]},
            {
              'files': [
              "$(XULSWORD)/Cpp/install.64win/dll/libgcc_s_seh-1.dll",
            ]},
          ]],
          'destination': 'build/Release'
        }
      ],
    }
  ],
  'variables' : {
    'openssl_fips': ''
  },

}
