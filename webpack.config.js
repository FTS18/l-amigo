const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const DevExtensionReloadPlugin = require('./scripts/dev-extension-reload-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    mode: argv.mode || 'production',
    devtool: isProd ? false : 'cheap-source-map',
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
    optimization: {
      usedExports: true,
      minimize: isProd,
      minimizer: [new TerserPlugin()],
      splitChunks: {
        chunks: (chunk) => chunk.name === 'popup',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(!isProd),
      }),
      new CopyPlugin({
        patterns: [
          { 
            from: 'public', 
            to: '.',
            globOptions: {
              ignore: ['**/popup.html']
            }
          },
        ],
      }),
      new HtmlWebpackPlugin({
        template: 'public/popup.html',
        filename: 'popup.html',
        chunks: ['popup'],
        cache: false,
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
