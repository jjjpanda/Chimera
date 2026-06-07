import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
	root: "frontend",
	base: "/",
	plugins: [react()],
	resolve: {
		extensions: [".js", ".jsx", ".json"],
		alias: {
			"@": path.resolve(__dirname, "frontend")
		}
	},
	esbuild: {
		loader: "jsx",
		include: /\.jsx?$/,
		exclude: /node_modules/
	},
	optimizeDeps: {
		esbuildOptions: {
			loader: { ".js": "jsx" }
		}
	},
	build: {
		outDir: "../dist",
		emptyOutDir: true
	}
})
