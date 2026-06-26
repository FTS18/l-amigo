const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const DevExtensionReloadPlugin = require('./scripts/dev-extension-reload-plugin');
const dotenv = require('dotenv');

// Load .env file (silently skipped if missing — CI/CD may inject env vars directly)
dotenv.config();

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
      dashboard: './src/dashboard/index.tsx',
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
        chunks: (chunk) => chunk.name === 'popup' || chunk.name === 'dashboard',
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
        // Secrets are injected at build-time only — never stored as literals in source
        'process.env.GITHUB_DEV_SECRET': JSON.stringify(process.env.GITHUB_DEV_SECRET || ''),
        'process.env.GITHUB_PROD_SECRET': JSON.stringify(process.env.GITHUB_PROD_SECRET || ''),
      }),
      new CopyPlugin({
        patterns: [
          { 
            from: 'public', 
            to: '.',
            globOptions: {
              ignore: ['**/popup.html', '**/dashboard.html']
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
      new HtmlWebpackPlugin({
        template: 'public/dashboard.html',
        filename: 'dashboard.html',
        chunks: ['dashboard'],
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
