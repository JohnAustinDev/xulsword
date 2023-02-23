/**
 * Base webpack config used across other specific configs
 */

import path from 'path';
import webpack from 'webpack';
import webpackPaths from './webpack.paths.js';
import { dependencies as externals } from '../../build/app/package.json';

export const xulswordWindows = [
  'splash',
  'xulsword',
  'viewport/viewportWin',
  'popup/popupWin',
  'chooseFont',
  'moduleManager',
  'removeModule',
  'search',
  'searchHelp',
  'about',
  'printPassage',
  'copyPassage',
  'bmProperties'
];

export default {
  externals: [...Object.keys(externals || {})],

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
          },
        },
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: {
      type: 'commonjs2',
    },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    fallback: { "path": false },
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
    }),
  ],
};
