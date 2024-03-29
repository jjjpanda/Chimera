require("dotenv").config()
const path = require("path")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const Dotenv = require("dotenv-webpack")

console.log(process.env.NODE_ENV)

module.exports = {
	mode: process.env.NODE_ENV,
	entry: {
		app: path.resolve(__dirname, "./frontend/App.jsx"),
	},
	output: {
		filename: "[name].js",
		path: path.resolve(__dirname, "dist")
	},
	resolve: {
		extensions: [".js", ".jsx"],
		alias: {
			path: "path-browserify",
			crypto: "crypto-browserify",
			stream: "stream-browserify"
		}
	},
	module: {
		rules: [
			{
				test: /\.jsx?$/,
				exclude: [/node_modules/],
				loader: "babel-loader"
			},
			{
				test: /\.less$/,
				use: [{
					loader: "style-loader" // creates style nodes from JS strings
				}, {
					loader: "css-loader" // translates CSS into CommonJS
				}, {
					loader: "less-loader", // compiles Less to CSS
					options: {
						lessOptions: {
							javascriptEnabled: true,
						}
					}
				}, 
				]},
			{
				test: /\.css$/,
				use: ["style-loader","css-loader"]
			},
			{
				test: /\.(png|jpg|gif)$/,
				exclude: /node_modules/,
				use: ["file-loader"]
			},
			{
				test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
				use: ["babel-loader", "svg-url-loader"],
			},
			{
				test: /\.(woff|woff2|eot|ttf|otf)$/,
				use: ["file-loader"],
			},
		]
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: path.resolve(__dirname, "frontend/reactTemplate.html"),
			chunks : ["app"],
			filename: "app.html"
		}),
		new Dotenv()
	]
}