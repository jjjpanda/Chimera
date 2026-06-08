import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig(({ mode }) => {
const env = loadEnv(mode, path.resolve(__dirname, ".."), "")
const gatewayTarget = `http://localhost:${env.gateway_PORT}`
return {
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
	},
	server: {
		proxy: {
			"/authorization": gatewayTarget,
			"/cameras": gatewayTarget,
			"/command/health": gatewayTarget,
			"/convert": gatewayTarget,
			"/file": gatewayTarget,
			"/motion": gatewayTarget,
			"/shared": gatewayTarget,
			"/database": gatewayTarget,
			"/storage": gatewayTarget,
			"/events": gatewayTarget,
			"/frames": gatewayTarget,
			"/usage": gatewayTarget,
			"/task": gatewayTarget,
			"/livestream": gatewayTarget,
			"/object": gatewayTarget,
			"/memory": { target: `ws://localhost:${env.gateway_PORT}`, ws: true },
		}
	}
}
})
