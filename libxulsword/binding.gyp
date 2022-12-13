{
  'targets': [
    {
      'target_name': 'libxulsword',
      'sources': [ 'src/libxulsword.cpp' ],
      'conditions': [
        ['OS=="linux"', {
          'libraries': ["$(XULSWORD)/Cpp/install/so/libxulsword-static.so"],
        }],
        ['OS=="win"', {
        'libraries': ["$(XULSWORD)/Cpp/lib/libxulsword-static.dll"],
        }]],

      'include_dirs': [
        "<!@(node -p \"require('node-addon-api').include\")",
        "$(XULSWORD)/Cpp/src/include",
        "$(XULSWORD)/Cpp/sword/include"
      ],
      'defines': [ 'NODE_GYP_MODULE_NAME=libxulsword' ],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
    }
  ],
  'variables' : {
    'openssl_fips': ''
  },

}
