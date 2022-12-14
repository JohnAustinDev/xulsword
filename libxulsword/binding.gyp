{
  'targets': [
    {
      'target_name': 'libxulsword',
      'conditions':[['OS=="win"', {
        'actions': [{
          'action_name': 'Create lib file',
          'message': 'Creating libxulsword.lib file...',
          'output': ['../win-napi/libxulsword.lib'],
          'conditions': [[
            '$(XCWD)=="32win"', {
              'action': ['lib.exe', '/def:../win-napi/libxulsword.def', '/machine:x86', '/out:../win-napi/libxulsword.lib'],
            }, {
              'action': ['lib.exe', '/def:../win-napi/libxulsword.def', '/machine:x64', '/out:../win-napi/libxulsword.lib'],
            }
          ]],
        }],
      }]],
      'sources': [ 'src/libxulsword.cpp' ],
      'include_dirs': [
        "<!@(node -p \"require('node-addon-api').include\")",
        "$(XULSWORD)/Cpp/src/include",
        "$(XULSWORD)/Cpp/sword/include"
      ],
      'conditions': [
        ['OS=="linux"', {
          'defines': [
            'NODE_GYP_MODULE_NAME=libxulsword' ]
        }],
        ['OS=="win"', {
          'defines': [
            'NODE_GYP_MODULE_NAME=libxulsword',
            'NAPI_DISABLE_CPP_EXCEPTIONS']
        }]],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'target_conditions': [
        ['OS=="linux"', {
          'libraries': ["$(XULSWORD)/Cpp/install/so/libxulsword-static.so"],
        }],
        ['OS=="win"', {
        'libraries': ['../win-napi/libxulsword.lib'],
        }]],
        'conditions': [['OS=="win"', {
          'copies': [{
            'files': ['Release/xulsword.node'],
            'destination': '../win-napi/xulsword.$(XCWD).node'
          }],
        }]],
      }
    ],
  'variables' : {
    'openssl_fips': ''
  },

}
