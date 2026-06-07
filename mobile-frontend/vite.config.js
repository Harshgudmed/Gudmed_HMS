import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Proxy target for the dev/preview server. Prefer an explicit VITE_PROXY_TARGET
  // (e.g. the live API) so the browser preview shows real data; fall back to
  // deriving it from VITE_API_URL, then localhost.
  const proxyTarget = env.VITE_PROXY_TARGET || env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'

  const apiProxy = {
    '/api': {
      target: proxyTarget,
      changeOrigin: true,
      // Drop the browser Origin so the API's CORS allowlist treats it as a
      // server-to-server call (requests with no Origin are always allowed).
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
      },
    },
  }

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: { port: 5173, proxy: apiProxy },
    preview: { port: 4173, proxy: apiProxy },
  }
})
