/*global process */
import fs from 'fs';
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
  main: [
    'electron-main',
    [
      './src/main/main.ts',
      './src/main/indexWorker.ts'
    ]
  ],

  preload: [
    'electron-preload',
    [
      './src/main/preload.ts'
    ]
  ],

  server: [
    'node',
    [
      './src/server/server.ts'
    ]
  ],

  renderer: [
    'web',
    [
      './src/renderer/splash/splash.tsx',
      './src/renderer/xulswordWin/xulswordWin.tsx',
      './src/renderer/viewportWin/viewportWin.tsx',
      './src/renderer/popupWin/popupWin.tsx',
      './src/renderer/chooseFont/chooseFont.tsx',
      './src/renderer/moduleManager/moduleManager.tsx',
      './src/renderer/removeModule/removeModule.tsx',
      './src/renderer/search/search.tsx',
      './src/renderer/searchHelp/searchHelp.tsx',
      './src/renderer/about/about.tsx',
      './src/renderer/printPassage/printPassage.tsx',
      './src/renderer/copyPassage/copyPassage.tsx',
      './src/renderer/bmProperties/bmProperties.tsx',
      './src/renderer/bmManager/bmManager.tsx',
    ],
  ],

  browser: [
    'web',
    [
      './src/browser/widgets/widgets.tsx',
      './src/browser/bibleBrowser/bibleBrowser.tsx'
    ],
  ],
};

// Vender modules don't change often, so are only compiled when 'yarn'
// (ie 'yarn install') is run, and are then reused by webpack's
// DllReferencePlugin.
const dllModules = {
  common: ['dompurify'],
  node: [
    'adm-zip',
    'express-session',
    'font-list',
    'gunzip-maybe',
    'helmet',
    'i18next',
    'i18next-fs-backend',
    'memorystore',
    'rate-limiter-flexible',
    'socket.io',
    'socket.io-client',
    'source-map-support',
    'tar-stream',
    'toobusy-js',
  ],
  'electron-main': [
    'electron',
    'electron-context-menu',
    'electron-debug',
    'electron-devtools-installer',
    'electron-log',
    'electron-updater',
    'ftp',
  ],
  'electron-preload': [],
  web: [
    '@blueprintjs/core',
    '@blueprintjs/select',
    '@blueprintjs/table',
    'prop-types',
    'react',
    'react-color',
    'react-dom',
    'react-dom/client',
  ],
};

export const devServerPort = 1212;

const defaultEnvironment = {
  WEBAPP_DOMAIN_AND_PORT: `http://localhost:${devServerPort}`,
  WEBAPP_PROFILE: path.join(projectPaths.rootPath, 'profile_webapp'),
  WEBAPP_SERVERROOT: path.join(projectPaths.rootPath, 'webapp', 'web'),
  RESOURCEDIR: path.join(projectPaths.rootPath, 'webapp', 'web', 'resources'),
  WEBAPP_PUBPATHS: '/',
  WEBAPP_PORT: 3576,
  WEBAPP_PUBLIC_DIST: '/',
  XSModsCommon: '',
  XSModsUser: '',
  XSAudio: '',
  XSFonts: '',
  LogDir: '',
};

export const parallelism = 10;

export default function (opts) {
  const envFlags = ['all', 'dll', 'packaged', 'development', 'production'];

  const { rootPath, srcPath, appDistPath, webappDistPath } = projectPaths;

  const { all } = opts;
  const dll = false; // TODO!: Fix dll?
  let { development, production, packaged } = opts;
  if (dll) {
    development = true;
    production = false;
    packaged = false;
    opts.main = true;
    opts.server = true;
    // Only about 250ms are saved on web targets.
    opts.renderer = true;
    opts.browser = true;
  } else if (all) {
    opts.main = true;
    opts.preload = true;
    opts.server = true;
    opts.renderer = true;
    opts.browser = true;
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
  if (dll) console.log('Building webpack dll...');

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

    const mydll = {
      manifest: path.join(rootPath, '.dll', build, `manifest.json`),
      path: path.join(rootPath, '.dll', build, 'dll.cjs'),
      libname: `xs_${build}_lib`,
      libtype: 'global',
    };
    mydll.use = development && fs.existsSync(mydll.manifest);
    if (mydll.use) console.log(`NOTE: Utilizing DLL: ${mydll.path}`);

    return {
      ...(development && !dll ? { devtool: 'source-map' } : {}),

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

      entry: !dll
        ? builds[build][1].reduce(
            (entries, entry) => {
              const name = path.basename(entry).replace(/\.[^.]+$/, '');
              entries[name] = { import: entry };
              if (mydll.use) entries[name].dependOn = `${build}_dll`;
              return entries;
            },
            mydll.use ? { [`${build}_dll`]: mydll.path } : {},
          )
        : {
            [build]: dllModules.common
              .concat(dllModules[builds[build][0]])
              .concat(
                builds[build][0] === 'electron-main' ? dllModules.node : [],
              ),
          },

      output: !dll
        ? {
            clean: true,
            filename: `[name].${['main', 'server'].includes(build) ? 'cjs' : 'js'}`,
            path: {
              main: path.join(appDistPath, 'main'),
              preload: path.join(appDistPath, 'preload'),
              renderer: path.join(appDistPath, 'renderer'),
              server: path.join(webappDistPath, 'server'),
              browser: path.join(webappDistPath, 'browser'),
            }[build],
            publicPath:
              build === 'browser'
                ? process.env.WEBAPP_PUBLIC_DIST ||
                  defaultEnvironment.WEBAPP_PUBLIC_DIST
                : './',
          }
        : {
            clean: true,
            path: path.dirname(mydll.path),
            filename: path.basename(mydll.path),
            library: { name: mydll.libname, type: mydll.libtype },
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
                      targets: ['main', 'server'].includes(build)
                        ? { node: '22' }
                        : '> 0.25%, not dead',
                    },
                  ],
                  ['renderer', 'browser'].includes(build)
                    ? ['@babel/preset-react', { development }]
                    : null,
                ].filter(Boolean),

                // React refresh webpack plugin
                ...(development && ['browser', 'renderer'].includes(build)
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
            'Build.isElectronApp': ['main', 'preload', 'renderer'].includes(
              build,
            ),
            'Build.isWebApp': ['server', 'browser'].includes(build),
            'Build.isClient': ['renderer', 'browser'].includes(build),
            'Build.isServer': ['main', 'server'].includes(build),
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
        build !== 'browser'
          ? new webpack.IgnorePlugin({
              resourceRegExp: /original-fs/,
              contextRegExp: /adm-zip/,
            })
          : null,
      ]
        .concat(
          !dll
            ? // Use these plugins when NOT building the dll:
              [
                // Note: you can't analyze a preload file.
                build !== 'preload'
                  ? new BundleAnalyzerPlugin({
                      analyzerMode: 'static',
                      openAnalyzer: false,
                    })
                  : null,

                development && ['browser', 'renderer'].includes(build)
                  ? new ReactRefreshWebpackPlugin()
                  : null,
              ]
                .concat(
                  builds[build][1].map((entry) => {
                    if (['browser', 'renderer'].includes(build)) {
                      const name = path.basename(entry).replace(/\.[^.]+$/, '');
                      let template = `${name}.html`;
                      if (build === 'renderer') template = 'root.html';
                      return new HtmlWebpackPlugin({
                        filename: `${name}.html`,
                        template: path.join(srcPath, build, template),
                        chunks: [name],
                      });
                    }
                    return null;
                  }),
                )
                .concat(
                  mydll.use
                    ? [
                        new webpack.DllReferencePlugin({
                          context: rootPath,
                          manifest: mydll.manifest,
                          name: mydll.libname,
                        }),
                      ]
                    : [],
                )
            : // Use this plugin only when building a dll:
              [
                new webpack.DllPlugin({
                  path: mydll.manifest,
                  name: mydll.libname,
                  type: mydll.libtype,
                  format: true,
                }),
              ],
        )
        .filter(Boolean),

      ...(['renderer', 'browser'].includes(build)
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
                  build === 'renderer' ? 'start:main' : 'start:server';
                console.log(
                  chalk.bgGreen.bold(
                    `Starting devServer with 'yarn ${start}':`,
                  ),
                );
                if (build === 'browser') {
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
                  .on('close', (code) => process.exit(code))
                  .on('error', (spawnError) => console.error(spawnError));
              },
            },
          }
        : {}),
    };
  }

  const config = Object.keys(builds)
    .filter((x) => x in opts)
    .map((x) => getConfig(x));

  // console.log(JSON.stringify(config, null, 2));

  return config;
}
