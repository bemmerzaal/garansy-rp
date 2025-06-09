const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'garansys_rp_styles': './src/garansys_rp_styles.css'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 9000,
    hot: true,
    open: true
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name].min.css'
    }),
    new CopyPlugin({
      patterns: [
        {
          from: './src/garansys_rp_schedular.js',
          to: 'js/garansys_rp_schedular.min.js',
          transform(content) {
            // Simple minification using Terser
            const { minify } = require('terser');
            return minify(content.toString(), {
              format: { comments: false },
              compress: true,
              mangle: true
            }).then(result => result.code);
          }
        },
        {
          from: './src/index.html',
          to: 'index.html',
          transform(content) {
            return content.toString()
              .replace('href="garansys_rp_styles.css"', 'href="css/garansys_rp_styles.min.css"')
              .replace('src="garansys_rp_schedular.js"', 'src="js/garansys_rp_schedular.min.js"');
          }
        }
      ]
    })
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new CssMinimizerPlugin()
    ]
  }
}; 