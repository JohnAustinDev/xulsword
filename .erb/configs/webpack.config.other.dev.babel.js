import path from 'path';
import fs from 'fs';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import chalk from 'chalk';
import { merge } from 'webpack-merge';
import { spawn, execSync } from 'child_process';
import baseConfig, { xulswordEntries, rulesDev } from './webpack.config.base';
import webpackPaths from './webpack.paths.js';
import checkNodeEnv from '../scripts/check-node-env';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';

const entries = {};
xulswordEntries.forEach((pth) => {
  const name = path.basename(pth);
  entries[name] = {
    import: [pth],
  };
});

// When an ESLint server is running, we can't set the NODE_ENV so we'll check if it's
// at the dev webpack config is not accidentally run in a production environment
if (process.env.NODE_ENV === 'production') {
  checkNodeEnv('development');
}

export default merge(baseConfig, {
  devtool: 'source-map',

  mode: 'development',

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
    // Replace rules[0] of rulesDev with this:
    rules: rulesDev.map((x, i) => {
      if (i === 0)
        return {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: require.resolve('babel-loader'),
            },
          ],
        };
      if (i === 1)
        return {
          test: /\.css$/,
          use: [
            {
              loader: MiniCssExtractPlugin.loader,
              options: {
                // `./dist` can't be inerhited for publicPath for styles. Otherwise generated paths will be ./dist/dist
                publicPath: './',
              },
            },
            {
              loader: 'css-loader',
              options: {
                sourceMap: true,
              },
            },
          ],
        };
      return x;
    }),
  },
  plugins: [
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

    new MiniCssExtractPlugin({
      filename: '[name]-style.css',
    }),
  ],

  node: {
    __dirname: false,
    __filename: false,
  },
});
