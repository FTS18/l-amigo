const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';
  
  return {
    mode: argv.mode || 'production',
    devtool: isProd ? false : 'inline-cheap-source-map',
    entry: {
      popup: './src/popup/popup.tsx',
      background: './src/background/background.ts',
      content: './src/content/leetcode-monitor.ts',
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
          use: isProd 
            ? [MiniCssExtractPlugin.loader, 'css-loader']
            : ['style-loader', 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'public', to: '.' },
        ],
      }),
      ...(isProd ? [new MiniCssExtractPlugin({ filename: '[name].css' })] : []),
    ],
  };
};
