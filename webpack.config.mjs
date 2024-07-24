/*global process */
import path from 'path';
import { spawn } from 'child_process';
import webpack from 'webpack';
import chalk from 'chalk';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import projectPaths from './scripts/projectPaths.mjs';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';

// Webpack entry points to build, grouped by target.
// prettier-ignore
const builds = {
  appSrv: [
    'electron-main',
    [
      './src/servers/app/server.ts',
      './src/servers/indexWorker.ts'
    ]
  ],

  preload: [
    'electron-preload',
    [
      './src/servers/app/preload.ts'
    ]
  ],

  webappSrv: [
    'node',
    [
      './src/servers/webapp/server.ts',
      './src/servers/indexWorker.ts'
    ]
  ],

  appClients: [
    'web',
    [
      './src/clients/app/splash/splash.tsx',
      './src/clients/app/xulswordWin/xulswordWin.tsx',
      './src/clients/app/viewportWin/viewportWin.tsx',
      './src/clients/app/popupWin/popupWin.tsx',
      './src/clients/app/chooseFont/chooseFont.tsx',
      './src/clients/app/moduleManager/moduleManager.tsx',
      './src/clients/app/removeModule/removeModule.tsx',
      './src/clients/app/search/search.tsx',
      './src/clients/app/searchHelp/searchHelp.tsx',
      './src/clients/app/about/about.tsx',
      './src/clients/app/printPassage/printPassage.tsx',
      './src/clients/app/copyPassage/copyPassage.tsx',
      './src/clients/app/bmProperties/bmProperties.tsx',
      './src/clients/app/bmManager/bmManager.tsx',
    ],
  ],

  webappClients: [
    'web',
    [
      './src/clients/webapp/widgets/widgets.tsx',
      './src/clients/webapp/bibleBrowser/bibleBrowser.tsx'
    ],
  ],
};

const defaultEnvironment = {
  WEBAPP_CORS_ORIGIN: 'http://localhost:1212',
  WEBAPP_PROFILE_DIR: path.join(projectPaths.rootPath, 'profile_webapp'),
  WEBAPP_SERVERROOT_DIR: path.join(
    projectPaths.rootPath,
    'profile_webapp',
    'web',
  ),
  WEBAPP_RESOURCE_DIR: path.join(
    projectPaths.rootPath,
    'profile_webapp',
    'web',
    'resources',
  ),
  WEBAPP_PUBPATHS: '/',
  WEBAPP_PORT: 3576,
  WEBAPP_PUBLIC_DIST: '/',
  WEBPACK_DEV_WEBAPP_PORT: 1212,
  WEBPACK_DEV_APP_PORT: 1213,
  XSModsUser_DIR: '',
  XSModsCommon_DIR: '',
  XSFonts_DIR: '',
  LOG_DIR: '',
  NODE_ENV: 'development',
};
const env = (v) => process.env[v] || defaultEnvironment[v];

export const parallelism = 10;

export default function (opts) {
  const envFlags = ['all', 'packaged', 'development', 'production'];

  const { rootPath, srcPath, appDistPath, webappDistPath } = projectPaths;

  const { all, development, production, packaged } = opts;
  if (all) {
    opts.appSrv = true;
    opts.preload = true;
    opts.webappSrv = true;
    opts.appClients = true;
    opts.webappClients = true;
  }

  // Validate webpack arguments...
  if ((!development && !production) || development === production) {
    throw new Error(
      `Must run webpack with either '--env production' or '--env development'`,
    );
  }
  if (Object.keys(builds).filter((x) => x in opts).length == 0) {
    throw new Error(
      `Must run webpack with one or more of: ${Object.keys(builds)
        .map((x) => `'--env ${x}'`)
        .join(' or ')}`,
    );
  }
  const unrecognized = Object.keys(opts).find(
    (k) =>
      !Object.keys(builds).concat(envFlags).includes(k) &&
      !k.startsWith('WEBPACK'),
  );
  if (unrecognized) {
    throw new Error(`Unrecognized --env value: '${unrecognized}'`);
  }

  console.log('Webpack configuration options: ', opts);

  // Return a config object for a build. Each --env build in the command line
  // will use this function to generate a config object to pass to Webpack.
  function getConfig(build) {
    const mimeTypes = {
      eot: 'application/vnd.ms-fontobject',
      gif: 'image/gif',
      ico: 'image/vnd.microsoft.icon',
      jpg: 'image/jpeg',
      otf: 'font/otf',
      png: 'image/png',
      svg: 'image/svg+xml',
      ttf: 'font/ttf',
      woff: 'application/font-woff',
      woff2: 'application/font-woff',
    };

    const useFileLoader = [
      'eot',
      'gif',
      'ico',
      'jpg',
      'otf',
      'svg',
      'ttf',
      'woff',
      'woff2',
    ];

    const useUrlLoader = ['png'];

    const devServerPort = env(
      build === 'appClients'
        ? 'WEBPACK_DEV_APP_PORT'
        : 'WEBPACK_DEV_WEBAPP_PORT',
    );

    defaultEnvironment.NODE_ENV = development ? 'development' : 'production';

    return {
      ...(development ? { devtool: 'source-map' } : {}),

      mode: development ? 'development' : 'production',

      target: builds[build][0],

      context: rootPath,

      resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        modules: [srcPath, 'node_modules'],
        fallback: { path: false },
      },

      optimization: {
        minimize: production ? true : false,
      },

      // libxulsword is packaged by electron-builder not Webpack.
      externals: {
        './build/Release/xulsword.node': `../../node_modules/libxulsword/build/Release/xulsword.node`,
      },
      externalsType: 'node-commonjs',

      entry: builds[build][1].reduce((entries, entry) => {
        const name = path.basename(entry).replace(/\.[^.]+$/, '');
        entries[name] = { import: entry };
        return entries;
      }, {}),

      output: {
        clean: true,
        filename: `[name].${['appSrv', 'webappSrv'].includes(build) ? 'cjs' : 'js'}`,
        path: {
          appSrv: path.join(appDistPath, 'appSrv'),
          preload: path.join(appDistPath, 'preload'),
          appClients: path.join(appDistPath, 'appClients'),
          webappSrv: path.join(webappDistPath, 'webappSrv'),
          webappClients: path.join(webappDistPath, 'webappClients'),
        }[build],
        publicPath:
          build === 'webappClients' ? env('WEBAPP_PUBLIC_DIST') : './',
      },

      module: {
        rules: [
          {
            test: /\.(js|jsx|ts|tsx)$/,
            exclude: /node_modules/,
            use: {
              loader: 'babel-loader',
              options: {
                ...(development
                  ? {
                      cacheDirectory: true,
                    }
                  : {}),

                presets: [
                  [
                    '@babel/preset-env',
                    {
                      targets: ['appSrv', 'webappSrv'].includes(build)
                        ? { node: '22' }
                        : '> 0.25%, not dead',
                    },
                  ],
                  ['appClients', 'webappClients'].includes(build)
                    ? ['@babel/preset-react', { development }]
                    : null,
                ].filter(Boolean),

                // React refresh webpack plugin
                ...(development &&
                ['webappClients', 'appClients'].includes(build)
                  ? {
                      plugins: ['react-refresh/babel'],
                    }
                  : {}),
              },
            },
          },
          {
            test: /\.css$/,
            use: [MiniCssExtractPlugin.loader, 'css-loader'],
          },
          ...useFileLoader.map((ext) => {
            return {
              test: new RegExp(`\\.${ext}$`),
              use: 'file-loader',
            };
          }),
          ...useUrlLoader.map((ext) => {
            return {
              test: new RegExp(`\\.${ext}$`),
              use: {
                loader: 'url-loader',
                options: {
                  ...(ext in mimeTypes
                    ? {
                        mimetype: mimeTypes[ext],
                      }
                    : {}),
                },
              },
            };
          }),
        ],
      },

      plugins: [
        new MiniCssExtractPlugin(),
        // While compiling the bundle, webpack will permanently set these build
        // and environment variables to the following values. Note: LOGLEVEL is
        // purposefully left out so it will remain 'live', taking on its value
        // at time of execution rather than time of building.
        new webpack.DefinePlugin(
          Object.entries({
            'Build.isProduction': !!production,
            'Build.isDevelopment': !!development,
            'Build.isElectronApp': ['appSrv', 'preload', 'appClients'].includes(
              build,
            ),
            'Build.isWebApp': ['webappSrv', 'webappClients'].includes(build),
            'Build.isClient': ['appClients', 'webappClients'].includes(build),
            'Build.isServer': ['appSrv', 'webappSrv'].includes(build),
            'Build.isPackaged': !!packaged,
            ...Object.entries(defaultEnvironment).reduce((entries, entry) => {
              const [name, value] = entry;
              entries[`process.env.${name}`] = process.env[name] ?? value;
              return entries;
            }, {}),
          }).reduce((entries, entry) => {
            // Values to DefinePlugin must be stringified values!
            entries[entry[0]] = JSON.stringify(entry[1]);
            return entries;
          }, {}),
        ),
        build !== 'webappClients'
          ? new webpack.IgnorePlugin({
              resourceRegExp: /original-fs/,
              contextRegExp: /adm-zip/,
            })
          : null,

        // Note: you can't analyze a preload file.
        build !== 'preload'
          ? new BundleAnalyzerPlugin({
              analyzerMode: 'static',
              openAnalyzer: false,
            })
          : null,

        development && ['webappClients', 'appClients'].includes(build)
          ? new ReactRefreshWebpackPlugin()
          : null,
      ]
        .concat(
          builds[build][1].map((entry) => {
            if (['webappClients', 'appClients'].includes(build)) {
              const name = path.basename(entry).replace(/\.[^.]+$/, '');
              return new HtmlWebpackPlugin({
                filename: `${name}.html`,
                template: path.join(
                  {
                    appClients: path.join(
                      srcPath,
                      'clients',
                      'app',
                      'root.html',
                    ),
                    webappClients: path.join(
                      srcPath,
                      'clients',
                      'webapp',
                      name,
                      `${name}.html`,
                    ),
                  }[build],
                ),
                chunks: [name],
              });
            }
            return null;
          }),
        )

        .filter(Boolean),

      ...(['appClients', 'webappClients'].includes(build)
        ? {
            devServer: {
              port: devServerPort,
              publicPath: '/',
              compress: true,
              noInfo: false,
              stats: 'errors-only',
              inline: true,
              lazy: false,
              hot: true,
              headers: { 'Access-Control-Allow-Origin': '*' },
              watchOptions: {
                aggregateTimeout: 300,
                ignored: /node_modules/,
                poll: 100,
              },
              historyApiFallback: {
                verbose: true,
                disableDotRule: false,
              },
              before() {
                const start =
                  build === 'appClients' ? 'start:appSrv' : 'start:webappSrv';
                console.log(
                  chalk.bgGreen.bold(
                    `Starting devServer with 'yarn ${start}':`,
                  ),
                );
                if (build === 'webappClients') {
                  console.log(
                    builds[build][1]
                      .map((html) =>
                        chalk.bgGreen.bold(
                          `localhost:${devServerPort}/${path.parse(html).name}.html`,
                        ),
                      )
                      .join('\n') + '\n',
                  );
                }
                spawn('yarn', [start], {
                  shell: true,
                  env: process.env,
                  stdio: 'inherit',
                })
                  .on('close', (code) => {
                    console.log(`devServer done: ${code}`);
                    process.exit(code);
                  })
                  .on('error', (spawnError) =>
                    console.error(`devServer error: ${spawnError}`),
                  );
              },
            },
          }
        : {}),
    };
  }

  const config = Object.keys(builds)
    .filter((x) => x in opts && opts[x])
    .map((x) => getConfig(x));

  // console.log(JSON.stringify(config, null, 2));

  return config;
}
