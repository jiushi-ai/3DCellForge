import {
  GENERATION_POLL_INTERVAL_MS,
  GENERATION_PROVIDER_OPTIONS,
  GENERATION_TIMEOUT_MS,
  MODEL_API_BASE,
} from '../config/appConfig.js'

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (!normalized.startsWith('/api/')) return normalized
  return `${MODEL_API_BASE.replace(/\/$/, '')}${normalized}`
}

export function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/**
 * 调用本地 Node API，并把浏览器 Failed to fetch 转成可操作的提示。
 * Calls the local Node API and turns browser Failed to fetch into an actionable message.
 */
async function requestLocalApi(path, options) {
  try {
    return await fetch(apiUrl(path), options)
  } catch (error) {
    const cause = error instanceof Error ? error.message : 'network error'
    throw new Error(`Cannot reach local API at ${MODEL_API_BASE}. Start it with npm run dev:api. (${cause})`)
  }
}

export async function readApiResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `Request failed with ${response.status}`)
  }
  return payload
}

export function getProviderPlan(provider) {
  return provider === 'auto' ? ['rodin', 'tripo', 'fal', 'hunyuan', 'cinematic'] : [provider || 'rodin']
}

export function getProviderLabel(provider) {
  if (provider === 'local') return 'Local'
  if (provider === 'cinematic') return 'JS Depth'
  if (provider === 'reference') return 'Khronos Reference'
  return GENERATION_PROVIDER_OPTIONS.find((item) => item.id === provider)?.label ?? 'Hyper3D'
}

export async function create3dGeneration({
  provider,
  imageDataUrl,
  fileName,
  prompt,
  modelId,
  multiViewImages,
}) {
  const response = await requestLocalApi('/api/3d/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      imageDataUrl,
      fileName,
      prompt,
      modelId,
      multiViewImages,
    }),
  })

  return readApiResponse(response)
}

export async function analyzeAssetImage({ imageDataUrl, fileName }) {
  const response = await requestLocalApi('/api/3d/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, fileName }),
  })

  return readApiResponse(response)
}

export async function uploadLocal3dModel(file) {
  const response = await requestLocalApi(`/api/3d/local-model?fileName=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'model/gltf-binary' },
    body: file,
  })

  return readApiResponse(response)
}

export async function get3dApiHealth() {
  const response = await requestLocalApi('/api/3d/health')
  return readApiResponse(response)
}

export async function get3dServerLogs(limit = 100) {
  const response = await requestLocalApi(`/api/3d/logs?limit=${encodeURIComponent(limit)}`)
  return readApiResponse(response)
}

export async function get3dGenerationStatus(taskId, provider) {
  const response = await requestLocalApi(`/api/3d/status/${encodeURIComponent(taskId)}?provider=${encodeURIComponent(provider || 'rodin')}`)
  return readApiResponse(response)
}

export async function waitFor3dModel(taskId, provider, onStatus) {
  const deadline = Date.now() + GENERATION_TIMEOUT_MS

  while (Date.now() < deadline) {
    await delay(GENERATION_POLL_INTERVAL_MS)
    const status = await get3dGenerationStatus(taskId, provider)
    onStatus?.(status)

    if (['success', 'completed', 'complete', 'done'].includes(String(status.status).toLowerCase())) {
      if (!status.modelUrl) throw new Error(`${getProviderLabel(provider)} finished but no GLB model URL was returned.`)
      return status
    }

    if (['failed', 'error', 'cancelled', 'canceled'].includes(String(status.status).toLowerCase())) {
      throw new Error(status.error || `${getProviderLabel(provider)} generation failed.`)
    }
  }

  throw new Error(`${getProviderLabel(provider)} generation timed out.`)
}
