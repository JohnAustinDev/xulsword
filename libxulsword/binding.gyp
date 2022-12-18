{
  'targets': [
    {
      'target_name': 'make_win_lib',
      'type': 'none',
      'target_conditions': [['OS=="win"', {
        'actions': [{
          'action_name': 'Create lib file',
	        'message': "CREATING libxulsword.lib...",
          'inputs': ["$(LIBXULSWORD)/lib/libxulsword.def"],
          'outputs': ['../lib/libxulsword.lib'],
          'action': ['lib', "/def:$(LIBXULSWORD)/lib/libxulsword.def", '/machine:$(WINMACHINE)', '/out:../lib/libxulsword.lib'],
        }],
      }]],
    },
    {
      'target_name': 'libxulsword',
      'dependencies': ['make_win_lib'],
      'sources': [ 'src/libxulsword.cpp' ],
      'include_dirs': [
        "<!@(node -p \"require('node-addon-api').include\")",
        "$(XULSWORD)/Cpp/src/include",
        "$(XULSWORD)/Cpp/sword/include"
      ],
      'defines': ['NODE_GYP_MODULE_NAME=libxulsword'],
      'conditions': [['OS=="win"', {
        'defines': ['NAPI_DISABLE_CPP_EXCEPTIONS']
      }]],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'target_conditions': [
      	['OS=="linux"', {'libraries': ["$(XULSWORD)/Cpp/install/so/libxulsword-static.so"]}],
        ['OS=="win"', { 'libraries': ['../lib/libxulsword.lib']}]],
      },
      {
      'target_name': 'save_win_binary',
      'type': 'none',
      'dependencies': ['libxulsword'],
        'target_conditions': [
          ['OS=="win"', {
            'copies': [{
              'files': ['build/Release/libxulsword.node'],
              'destination': "$(LIBXULSWORD)/lib/$(XCWD)"
            }, {
              'files': ['build/Release/libxulsword.node'],
              'destination': "lib/$(XCWD)"
            }],
          }],
          ['OS=="linux"', {
            'copies': [{
              'files': ['build/Release/xulsword.node'],
              'destination': "$(LIBXULSWORD)/lib/linux"
            }, {
              'files': ['build/Release/xulsword.node'],
              'destination': "lib/linux"
            }],
          }]],
      }
    ],
  'variables' : {
    'openssl_fips': ''
  },

}
