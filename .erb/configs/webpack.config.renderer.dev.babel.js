import path from 'path';
import fs from 'fs';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import chalk from 'chalk';
import { merge } from 'webpack-merge';
import { spawn, execSync } from 'child_process';
import baseConfig, { xulswordWindows, rulesDev } from './webpack.config.base';
import webpackPaths from './webpack.paths.js';
import checkNodeEnv from '../scripts/check-node-env';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';

const entries = {};
xulswordWindows.forEach((xsw) => {
  let name = xsw;
  let dir = xsw;
  let file = `${xsw}.tsx`;
  if (xsw.indexOf('/') !== -1) {
    const p = xsw.split('/');
    name = p[p.length - 1];
    [dir] = p;
    p.shift();
    file = p.join('/');
  }
  entries[name] = {
    import: [
      'webpack-dev-server/client?http://localhost:1212/dist',
      'webpack/hot/only-dev-server',
      'core-js',
      'regenerator-runtime/runtime',
      path.join(webpackPaths.srcRendererPath, dir + '/' + file)
    ]
  };
});

// When an ESLint server is running, we can't set the NODE_ENV so we'll check if it's
// at the dev webpack config is not accidentally run in a production environment
if (process.env.NODE_ENV === 'production') {
  checkNodeEnv('development');
}

const port = process.env.PORT || 1212;
const publicPath = webpackPaths.distRendererPath;
const manifest = path.resolve(webpackPaths.dllPath, 'renderer.json');
const requiredByDLLConfig = module.parent.filename.includes(
  'webpack.config.renderer.dev.dll'
);

/**
 * Warn if the DLL is not built
 */
if (
  !requiredByDLLConfig &&
  !(fs.existsSync(webpackPaths.dllPath) && fs.existsSync(manifest))
) {
  console.log(
    chalk.black.bgYellow.bold(
      'The DLL files are missing. Sit back while we build them for you with "yarn build-dll"'
    )
  );
  execSync('yarn postinstall');
}

export default merge(baseConfig, {
  devtool: 'source-map',

  mode: 'development',

  target: ['web', 'electron-renderer'],

  entry: entries,

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: '/',
    filename: '[name].dev.js',
    library: {
      type: 'umd',
    },
  },

  module: {
    rules: rulesDev,
  },
  plugins: [
    requiredByDLLConfig
      ? null
      : new webpack.DllReferencePlugin({
          context: webpackPaths.dllPath,
          manifest: require(manifest),
          sourceType: 'var',
        }),

    new webpack.NoEmitOnErrorsPlugin(),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     *
     * By default, use 'development' as NODE_ENV. This can be overriden with
     * 'staging', for example, by changing the ENV variables in the npm scripts
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true,
    }),

    new ReactRefreshWebpackPlugin(),

  ].concat(xulswordWindows.map((xsw) => {
    let name = xsw;
    if (xsw.indexOf('/') !== -1) {
      const p = xsw.split('/');
      name = p[p.length - 1];
    }
    return new HtmlWebpackPlugin({
      filename: path.join(name + '.html'),
      template: path.join(webpackPaths.srcRendererPath, 'root.html'),
      chunks: [name],
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      env: process.env.NODE_ENV,
      isDevelopment: process.env.NODE_ENV !== 'production',
      nodeModules: webpackPaths.appNodeModulesPath,
    });
  })),

  node: {
    __dirname: false,
    __filename: false,
  },

  devServer: {
    port,
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
      console.log('Starting Main Process...');
      spawn('npm', ['run', 'start:main'], {
        shell: true,
        env: process.env,
        stdio: 'inherit',
      })
        .on('close', (code) => process.exit(code))
        .on('error', (spawnError) => console.error(spawnError));
    },
  },
});
