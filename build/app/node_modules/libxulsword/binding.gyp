{
  'targets': [
    {
      'target_name': 'make_win_lib',
      'type': 'none',
      'target_conditions': [['OS=="win"', {
        'actions': [{
          'action_name': 'Create lib from def file',
	        'message': "CREATING libxulsword.lib...",
          'inputs': ['../lib/libxulsword.def'],
          'outputs': ['../lib/libxulsword.lib'],
          'action': ['lib', '/def:../lib/libxulsword.def', '/machine:$(WINMACHINE)', '/out:../lib/libxulsword.lib'],
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
      	['OS=="linux"', {'libraries': ["$(XULSWORD)/Cpp/lib/libxulsword-static.so"]}],
        ['OS=="win"', { 'libraries': ['../lib/libxulsword.lib']}]],
      }
    ],
  'variables' : {
    'openssl_fips': ''
  },

}
