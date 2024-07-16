/*global process */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import projectPaths from './scripts/projectPaths.mjs';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';

const builds = {
  main: ['electron-main', ['./src/main/main.ts', './src/main/indexWorker.ts']],

  preload: ['electron-preload', ['./src/main/preload.ts']],

  renderer: [
    'electron-renderer',
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

  server: ['node', ['./src/server/server.ts']],

  browser: [
    'web',
    ['./src/browser/widgets.tsx', './src/browser/bibleBrowser.tsx'],
  ],
};

export const parallelism = 10;

export default function (opts) {
  console.log('Webpack configuration options: ', opts);

  const { development, production, dll } = opts;

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

    const { rootPath, srcPath, appDistPath, webappDistPath } = projectPaths;

    return {
      ...(development ? { devtool: 'source-map' } : {}),

      mode: development ? 'development' : 'production',

      target: builds[build][0],

      context: rootPath,

      resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        modules: [srcPath, 'node_modules'],
      },

      optimization: {
        minimize: production ? true : false,
      },

      // libxulsword is packaged by electron-builder not Webpack.
      externalsType: 'node-commonjs',
      externals: {
        './build/Release/xulsword.node': '../../../../node_modules/libxulsword/build/Release/xulsword.node',
      },

      entry: builds[build][1].reduce((entries, entry) => {
        const name = path.basename(entry).replace(/\.[^.]+$/, '');
        entries[name] = entry;
        return entries;
      }, {}),

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
              build === 'browser' ? process.env.SERVER_PUBLIC_DIST : './',
          }
        : {
            clean: true,
            path: path.join(rootPath, '.dll', build),
            filename: 'dll.[name].js',
            library: {
              name: '[name]_[fullhash]',
              type: 'var',
            }
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
        // Use these plugins whether building the dll or not:
        new MiniCssExtractPlugin(),

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
                  builds[build][1].map((entry) => {
                    const name = path.basename(entry).replace(/\.[^.]+$/, '');
                    const manifest = path.join(
                      rootPath,
                      '.dll',
                      build,
                      `${name}-manifest.json`,
                    );
                    if (fs.existsSync(manifest)) {
                      console.log(`NOTE: Utilizing DLL ${manifest}`);
                      return new webpack.DllReferencePlugin({
                        context: path.join(rootPath, '.dll', build),
                        manifest,
                        sourceType: 'var',
                      });
                    }
                    return null;
                  }),
                )
            : // Use this plugin only when building the dll:
              [
                new webpack.DllPlugin({
                  path: path.join(rootPath, '.dll', build, '[name]-manifest.json'),
                  name: '[name]',
                }),
              ],
        )
        .filter(Boolean),

      ...(['renderer', 'browser'].includes(build)
        ? {
            devServer: {
              port: process.env.PORT || 1212,
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
                console.log(`Starting devServer: ${start}...`);
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
