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
import baseConfig, { xulswordEntries, rulesProd } from './webpack.config.base';
import webpackPaths from './webpack.paths.js';
import checkNodeEnv from '../scripts/check-node-env';
import deleteSourceMaps from '../scripts/delete-source-maps';

const entries = {};
xulswordEntries.forEach((pth) => {
  const name = path.basename(pth);
  entries[name] = {
    import: [
      pth
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
    path: webpackPaths.distPath,
    publicPath: process.env.XULSWORD_SERVER_DIST,
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
    ],*/
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

  ],
});
