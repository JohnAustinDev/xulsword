/*global process */
import path from 'path';
import { spawn, execSync } from 'child_process';
import webpack from 'webpack';
import chalk from 'chalk';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as sass from 'sass';
import CompressionPlugin from 'compression-webpack-plugin';
import projectPaths from './scripts/projectPaths.mjs';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';

// Webpack entry points to build, grouped by target.
// prettier-ignore
const builds = {
  appSrv: [
    'electron-main',
    [
      './src/servers/app/server.ts',
      './src/servers/app/indexWorker.ts'
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
    ]
  ],

  appClients: [
    'web',
    [
      './src/clients/app/splashWin/splashWin.tsx',
      './src/clients/app/xulswordWin/xulswordWin.tsx',
      './src/clients/app/viewportWin/viewportWin.tsx',
      './src/clients/app/popupWin/popupWin.tsx',
      './src/clients/app/chooseFontWin/chooseFontWin.tsx',
      './src/clients/app/moduleManagerWin/moduleManagerWin.tsx',
      './src/clients/app/removeModuleWin/removeModuleWin.tsx',
      './src/clients/app/searchWin/searchWin.tsx',
      './src/clients/app/searchHelpWin/searchHelpWin.tsx',
      './src/clients/app/aboutWin/aboutWin.tsx',
      './src/clients/app/printPassageWin/printPassageWin.tsx',
      './src/clients/app/copyPassageWin/copyPassageWin.tsx',
      './src/clients/app/bmPropertiesWin/bmPropertiesWin.tsx',
      './src/clients/app/bmManagerWin/bmManagerWin.tsx',
    ],
  ],

  webappClients: [
    'web',
    [
      './src/clients/webapp/widgets/widgets.tsx',
      './src/clients/webapp/bibleBrowser/bibleBrowser.tsx'
    ],
  ],

  library: [
    'web',
    [
      './src/clients/analytics.ts',
    ]
  ]
};

// webappClients (bibleBrowser, widgets) and library (analytics.ts, loaded
// alongside them) are embedded in third-party pages and viewed on whatever
// mobile browser a visitor happens to have, so their babel target reaches
// back to ~2018 devices rather than following '> 0.25%, not dead' (which
// tracks current evergreen browsers and is fine for the Electron-only
// appClients/appSrv/preload builds, always run on a bundled modern
// Chromium).
const webappClientsBrowserslist =
  'ios_saf >= 11, chrome >= 63, and_chr >= 63, samsung >= 8, firefox >= 58, and_ff >= 58, not dead';

const defaultEnvironment = {
  WEBAPP_DOMAIN: 'http://localhost:1212',
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
    'resources',
  ),
  WEBAPP_PUBPATHS: '/',
  WEBAPP_PORT: 3576,
  WEBAPP_PUBLIC_DIST: '/',
  WEBPACK_DEV_WEBAPP_PORT: 1212,
  WEBPACK_DEV_APP_PORT: 1213,
  XSModsUser_DIR: '',
  XSModsCommon_DIR: '',
  XSAudio_DIR: '',
  XSFonts_DIR: '',
  LOG_DIR: '',
  NODE_ENV: '',
  SERVER_KEY_PEM: '',
  SERVER_CRT_PEM: '',
  WEBAPP_MAX_CACHE_RAMMB: 250,
  WEBAPP_SEARCH_BAN: 2000,
  LOGLEVEL: 'info',
  NODE_VERSION: '24.18.0',
};
const env = (k) =>
  (k in process.env && process.env[k]) || defaultEnvironment[k];

export const parallelism = 10;

export default function (opts) {
  const envFlags = ['all', 'packaged', 'development', 'production'];

  const { rootPath, srcPath, appDistPath, webappDistPath } = projectPaths;

  const { all, packaged } = opts;
  if (all) {
    opts.appSrv = true;
    opts.preload = true;
    opts.webappSrv = true;
    opts.appClients = true;
    opts.webappClients = true;
    opts.library = true;
  }

  // Validate webpack arguments...
  let { development, production } = opts;
  // To enable DevTools in a packaged app, run: export NODE_ENV=development
  if (
    'NODE_ENV' in process.env &&
    ['development', 'production'].includes(process.env.NODE_ENV)
  ) {
    opts.development = process.env.NODE_ENV === 'development';
    opts.production = process.env.NODE_ENV === 'production';
    ({ development, production } = opts);
  }
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

  defaultEnvironment.NODE_ENV = development ? 'development' : 'production';

  console.log(
    Object.keys(defaultEnvironment).reduce((p, k) => {
      p[k] = env(k);
      return p;
    }, {}),
  );

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

    const allowgzip = false;

    const githash = (() => {
      try {
        const hash = execSync('git rev-parse HEAD').toString().trim();
        return hash;
      } catch {
        return 'unknown';
      }
    })();

    return {
      ...(development ? { devtool: 'source-map' } : {}),

      mode: development ? 'development' : 'production',

      target: builds[build][0],

      context: rootPath,

      resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        modules: [srcPath, 'node_modules'],
        fallback: { path: false },
        alias: {
          // @blueprintjs/icons' default entry point (its package.json "main"
          // and "module" fields) resolves to a generated barrel that
          // `export *`s its entire icon set for both the 16px and 20px icon
          // grids. Those barrel re-exports can't be tree-shaken, so anything
          // that imports from bare '@blueprintjs/icons' - including
          // @blueprintjs/core itself - pulls every icon of both sizes into
          // the bundle. Redirect it to a hand-written shim that re-exports
          // only what's actually used, each from its own small module.
          '@blueprintjs/icons$': path.join(
            srcPath,
            'clients/components/libxul/blueprintIconsShim.ts',
          ),
          // bibleBrowser.tsx and widgets.tsx (via controller.tsx) only render
          // a small subset of Blueprint's components, but the compiled
          // '@blueprintjs/core/lib/css/blueprint.css' bundles every
          // component's styles as one static file with no way to tree-shake
          // it. Redirect that import, for the webappClients build only, to a
          // hand-curated Sass file that assembles just the component
          // partials actually used (see blueprintSubset.scss for how that
          // set was determined and how to keep it up to date). The
          // appClients (Electron) build keeps the full compiled CSS since
          // its windows use many more Blueprint components.
          ...(build === 'webappClients'
            ? {
                '@blueprintjs/core/lib/css/blueprint.css$': path.join(
                  srcPath,
                  'clients/webapp/blueprintSubset.scss',
                ),
              }
            : {}),
        },
      },

      optimization: {
        minimize: production ? true : false,
        ...(build === 'webappClients'
          ? {
              moduleIds: 'deterministic',
              runtimeChunk: 'single',
              splitChunks: {
                cacheGroups: {
                  vendor: {
                    test: (m) =>
                      /[\\/]node_modules[\\/]/.test(m.resource) &&
                      !/blueprint/i.test(m.resource) &&
                      // Dynamically imported so only browsers lacking a
                      // native ResizeObserver fetch it (see tabs.tsx); keep
                      // it out of the eagerly-loaded vendors chunk so it
                      // stays its own on-demand chunk.
                      !/resize-observer-polyfill/i.test(m.resource),
                    name: 'vendors',
                    chunks: 'all',
                  },
                },
              },
            }
          : {}),
      },

      // libxulsword is packaged by electron-builder not Webpack.
      externals: {
        './build/Release/xulsword.node': `node-commonjs ../../node_modules/libxulsword/build/Release/xulsword.node`,
        ...(!builds[build][0].startsWith('electron')
          ? { electron: 'return {};' }
          : {}),
      },

      entry: builds[build][1].reduce((entries, entry) => {
        if (typeof entry === 'object') {
          entries[Object.keys(entry)[0]] = entry[Object.keys(entry)[0]];
          return entries;
        } else {
          const name = path.basename(entry).replace(/\.[^.]+$/, '');
          entries[name] = { import: entry };
          return entries;
        }
      }, {}),

      output: {
        clean: true,
        filename: `[name]${
          ['appSrv', 'webappSrv'].includes(build)
            ? '.cjs'
            : ['webappClients', 'library'].includes(build)
              ? `_${githash.substr(0, 12)}.js`
              : '.js'
        }`,
        path: {
          appSrv: path.join(appDistPath, 'appSrv'),
          preload: path.join(appDistPath, 'preload'),
          appClients: path.join(appDistPath, 'appClients'),
          webappSrv: path.join(webappDistPath, 'webappSrv'),
          webappClients: path.join(webappDistPath, 'webappClients'),
          library: path.join(webappDistPath, 'library'),
        }[build],
        publicPath: ['webappClients', 'library'].includes(build)
          ? env('WEBAPP_PUBLIC_DIST')
          : './',
        ...(build === 'library'
          ? { library: 'xulsword', globalObject: 'globalThis' }
          : {}),
      },

      module: {
        rules: [
          {
            test: /\.(js|jsx|ts|tsx)$/,
            exclude: /node_modules/,
            use: {
              loader: 'babel-loader',
              options: {
                ...(development ? { cacheDirectory: true } : {}),

                presets: [
                  [
                    '@babel/preset-env',
                    {
                      targets: ['appSrv', 'webappSrv'].includes(build)
                        ? { node: env('NODE_VERSION') }
                        : ['webappClients', 'library'].includes(build)
                          ? webappClientsBrowserslist
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
                  ? { plugins: ['react-refresh/babel'] }
                  : {}),
              },
            },
            sideEffects: false,
          },
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
          {
            test: /\.scss$/,
            use: [
              MiniCssExtractPlugin.loader,
              'css-loader',
              { loader: 'sass-loader', options: { implementation: sass } },
            ],
          },
          ...useFileLoader.map((ext) => {
            return { test: new RegExp(`\\.${ext}$`), use: 'file-loader' };
          }),
          ...useUrlLoader.map((ext) => {
            return {
              test: new RegExp(`\\.${ext}$`),
              use: {
                loader: 'url-loader',
                options: {
                  ...(ext in mimeTypes ? { mimetype: mimeTypes[ext] } : {}),
                },
              },
            };
          }),
        ],
      },

      plugins: [
        new MiniCssExtractPlugin(),
        // While compiling the bundle, DefinePlugin will permanently set all build
        // and environment variables to these fixed values.
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

        // @blueprintjs/core components that render an icon from a raw name
        // string (Tag, Alert, Toast, etc.) rather than through our own Icon
        // (./src/clients/components/libxul/icon.tsx) bypass the
        // '@blueprintjs/icons' alias above entirely: they call that
        // package's Icons.load(), whose default loader dynamically imports
        // the *entire* generated 16px or 20px icon path barrel (~680 icons
        // each, un-tree-shakeable) depending on the requested icon size.
        // Redirect both barrels to a shim that re-exports only the icons
        // already curated in blueprintIconsShim.ts, so neither full barrel
        // ends up in the bundle. This app only ships the 20px grid, so 16px
        // requests are served the same path data as 20px ones.
        new webpack.NormalModuleReplacementPlugin(
          /@blueprintjs[\\/]icons[\\/]lib[\\/]esm[\\/]generated[\\/](?:16|20)px[\\/]paths(?:[\\/]index\.js)?$/,
          path.join(
            srcPath,
            'clients/components/libxul/blueprintIconPathsShim.ts',
          ),
        ),

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
          builds[build][1].map(() => {
            return allowgzip && production && build === 'webappClients'
              ? new CompressionPlugin({
                  deleteOriginalAssets: true,
                  threshold: 30000,
                  exclude: /\.ttf\b/,
                })
              : null;
          }),
        )
        .concat(
          builds[build][1].map((entry) => {
            if (['webappClients', 'appClients'].includes(build)) {
              const name = path.basename(entry).replace(/\.[^.]+$/, '');
              return new HtmlWebpackPlugin({
                filename: `${name}.html`,
                scriptLoading: 'defer',
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

      // Dev Server can't work in development mode unless CompressionPlugin
      // deleteOriginalAssets is false.
      ...(development && ['appClients', 'webappClients'].includes(build)
        ? {
            devServer: {
              port: devServerPort,
              serveIndex: true,
              hot: true,
              publicPath: '/', // required for app development server
              headers: { 'Access-Control-Allow-Origin': '*' },
              before() {
                const start =
                  build === 'appClients' ? 'start:appSrv' : 'start:webappSrv';
                console.log(
                  chalk.bgGreen.bold(
                    `Starting devServer with 'yarn ${start}':`,
                  ),
                );
                console.log(
                  chalk.bgGreen.bold(
                    `localhost:${devServerPort}/webpack-dev-server`,
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
                      .join('\n'),
                  );
                  console.log(
                    chalk.bgGreen.bold(
                      `localhost:${devServerPort}/src/clients/webapp/bibleBrowser/bibleBrowserParent.html` +
                        '\n',
                    ),
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
