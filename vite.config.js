import { spawn } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const LOCAL_API_ORIGIN = 'http://127.0.0.1:8787'
let apiProcess = null

/**
 * 开发时自动拉起本地 8787 API，避免前端 Hunyuan/Tripo 请求 Failed to fetch。
 * Starts the local 8787 API during Vite dev so Hunyuan/Tripo requests are not Failed to fetch.
 */
function startLocalApiPlugin() {
  return {
    name: 'start-local-api',
    async configureServer() {
      await ensureLocalApi()
    },
  }
}

/**
 * 若 8787 未就绪则启动 node server.mjs。
 * Spawns node server.mjs when port 8787 is not already serving health.
 */
async function ensureLocalApi() {
  if (await isLocalApiHealthy()) return
  if (apiProcess) return

  apiProcess = spawn(process.execPath, ['server.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  })
  apiProcess.on('exit', () => {
    apiProcess = null
  })
}

/**
 * 探测本地 Node API 是否可访问。
 * Probes whether the local Node API health endpoint is reachable.
 */
async function isLocalApiHealthy() {
  try {
    const response = await fetch(`${LOCAL_API_ORIGIN}/api/3d/health`)
    return response.ok
  } catch {
    return false
  }
}

export default defineConfig({
  plugins: [react(), startLocalApiPlugin()],
  server: {
    proxy: {
      '/api': {
        target: LOCAL_API_ORIGIN,
        changeOrigin: true,
      },
    },
  },
})
