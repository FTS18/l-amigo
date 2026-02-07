const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => ({
  mode: argv.mode || 'production',
  devtool: argv.mode === 'development' ? 'inline-cheap-source-map' : false,
  entry: {
    popup: './src/popup/popup.tsx',
    background: './src/background/background.ts',
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
        use: ['style-loader', 'css-loader'],
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
  ],
});
