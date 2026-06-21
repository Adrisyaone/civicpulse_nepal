import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Dev-only: proxy /.netlify/functions/upload-photo → GAS, mimicking the
// Netlify function so plain `npm run dev` works without `netlify dev`.
function netlifyFunctionsDev(gasUrl) {
  return {
    name: 'netlify-functions-dev',
    configureServer(server) {
      server.middlewares.use('/.netlify/functions/upload-photo', (req, res) => {
        res.setHeader('Content-Type', 'application/json')

        if (!gasUrl) {
          res.end(JSON.stringify({ error: 'VITE_SHEETS_API_URL not set in .env.local' }))
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method Not Allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk.toString() })
        req.on('end', async () => {
          try {
            const gasRes = await fetch(gasUrl, {
              method:  'POST',
              body:    body,
              headers: { 'Content-Type': 'text/plain' },
            })
            const text = await gasRes.text()
            try {
              JSON.parse(text)
              res.end(text)
            } catch {
              res.end(JSON.stringify({ error: `GAS returned non-JSON (${gasRes.status}): ${text.slice(0, 200)}` }))
            }
          } catch (err) {
            res.end(JSON.stringify({ error: `Proxy failed: ${err.message}` }))
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), netlifyFunctionsDev(env.VITE_SHEETS_API_URL)],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server:  { port: 5173 },
    build:   { chunkSizeWarningLimit: 1500 },
  }
})
