const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const DevExtensionReloadPlugin = require('./scripts/dev-extension-reload-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    mode: argv.mode || 'production',
    devtool: isProd ? false : 'inline-cheap-source-map',
    entry: {
      popup: './src/popup/popup.tsx',
      background: './src/background/background.ts',
      content: './src/content/leetcode-monitor.ts',
      codeforces: './src/content/codeforces.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(!isProd),
      }),
      new CopyPlugin({
        patterns: [
          { from: 'public', to: '.' },
        ],
      }),
      new MiniCssExtractPlugin({ filename: '[name].css' }),
      ...(isProd
        ? []
        : [
            new DevExtensionReloadPlugin({ port: 9091 }),
          ]),
    ],
  };
};
