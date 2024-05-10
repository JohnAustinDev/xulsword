/**
 * Build config for electron renderer process
 */

import path from 'path';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { merge } from 'webpack-merge';
//import TerserPlugin from 'terser-webpack-plugin';
import baseConfig, { xulswordWindows, rulesProd } from './webpack.config.base';
import webpackPaths from './webpack.paths.js';
import checkNodeEnv from '../scripts/check-node-env';
import deleteSourceMaps from '../scripts/delete-source-maps';

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
      'core-js',
      'regenerator-runtime/runtime',
      path.join(webpackPaths.srcRendererPath, dir + '/' + name)
    ]
  };
});

checkNodeEnv('production');
deleteSourceMaps();

const devtoolsConfig =
  process.env.DEBUG_PROD === 'true'
    ? {
        devtool: 'source-map',
      }
    : {};

export default merge(baseConfig, {
  ...devtoolsConfig,

  mode: 'production',

  target: ['web', 'electron-renderer'],

  entry: entries,

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: './',
    filename: '[name].js',
    library: {
      type: 'umd',
    },
  },

  module: {
    rules: rulesProd,
  },
  optimization: {
    // concatenateModules: false,
    minimize: true,
    // Important! The TerserPlugin causeed runtime errors and CSS glitches. Don't use.
    /*
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
      new CssMinimizerPlugin()
    ],
    */
  },
  plugins: [
    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: false,
    }),

    new MiniCssExtractPlugin({
      filename: '[name]-style.css',
    }),

    new BundleAnalyzerPlugin({
      analyzerMode:
        process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true',
      analyzerPort: 8889,
    }),

  ].concat(xulswordWindows.map((xsw) => {
    let name = xsw;
    if (xsw.indexOf('/') !== -1) {
      const p = xsw.split('/');
      name = p[p.length - 1];
    }
    return new HtmlWebpackPlugin({
      filename: name + '.html',
      template: path.join(webpackPaths.srcRendererPath, 'root.html'),
      chunks: [name],
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: process.env.NODE_ENV !== 'production',
    });
  })),
});
