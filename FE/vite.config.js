import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      host: true, // Expose to 0.0.0.0
      port: parseInt(env.PORT) || 5173,
      allowedHosts: ['res.infidea.dev']
    },
  }
})
