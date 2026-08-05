const path = require('path')

/** @type {import('@rspack/core').Configuration} */
module.exports = {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        resourceQuery: /inline/,
        type: 'asset/source',
      },
      {
        test: /\.css$/,
        resourceQuery: { not: [/inline/] },
        use: [
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                configFile: path.resolve(__dirname, 'postcss.config.js'),
              },
            },
          },
        ],
      },
    ],
  },
}
