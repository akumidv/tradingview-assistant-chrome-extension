const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const TransformJson = require('transform-json-webpack-plugin')
const packageDict = require('./package.json')

const _resolve = {
  extensions: ['.js'],
  modules: [
    path.resolve(__dirname, 'node_modules'),
    'node_modules'
  ]
}

const _module = {
  rules: [
    {
      test: /\.jsx?$/,
      exclude: path.resolve(__dirname, 'src'),
      enforce: 'pre',
      use: 'source-map-loader'
    },
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: 'babel-loader'
    },
    {
      test: /\.css$/,
      use: [{
        loader: 'style-loader'
      }, {
        loader: 'css-loader'
      }]
    }
  ]
}

module.exports = [{
  mode: 'production',
  // entry: './src/index.js',
  entry: [
    path.resolve(__dirname, 'src', 'content_scripts', 'controller.js')
  ],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: path.join('content_scripts', 'tvassistant_bundle.js')
  },
  resolve: {
    alias: {
      action: path.resolve(__dirname, 'src/content_scripts/action.js'),

    }
  }
  // resolve: _resolve
  // output: {
  //   filename: 'main.js',
  //   path: path.resolve(__dirname, 'dist')
  // }
}]