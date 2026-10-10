import { fetch as undiciFetch } from 'undici'

import {
  HUNYUAN_API_BASE,
  HUNYUAN_API_KEY,
  HUNYUAN_CLOUD_BASE,
  HUNYUAN_CREATE_PATH,
  HUNYUAN_MODEL,
  HUNYUAN_STATUS_PATH,
  OUTBOUND_PROXY_AGENT,
  hasOutboundProxy,
} from '../config.mjs'
import { parseDataUrl } from '../http-utils.mjs'
import { cacheRemoteModelAs, hasLocalModel, localModelUrl, saveLocalModel } from '../model-store.mjs'
import { findFirstValue, findModelUrl } from '../object-utils.mjs'
import {
  buildHunyuanCloudSubmitFields,
  decodeHunyuanCloudTaskId,
  encodeHunyuanCloudTaskId,
  extractHunyuanCloudErrorMessage,
  findHunyuanGlbResult,
  formatHunyuanAuthHeader,
  getHunyuanCloudProgress,
  inferHunyuanCloudStatus,
  isHunyuanCloudTaskId,
  normalizeHunyuanCloudStatus,
  normalizeHunyuanStatus,
} from './hunyuan-utils.mjs'

export {
  buildHunyuanCloudSubmitFields,
  decodeHunyuanCloudTaskId,
  encodeHunyuanCloudTaskId,
  findHunyuanGlbResult,
  formatHunyuanAuthHeader,
  isHunyuanCloudTaskId,
  normalizeHunyuanCloudStatus,
  normalizeHunyuanStatus,
}

/**
 * 返回 Hunyuan Provider 健康状态（云端 API Key 或本地 8081）。
 * Returns Hunyuan provider health (cloud API key or local 8081).
 */
export function getHunyuanHealth() {
  const cloud = Boolean(HUNYUAN_API_KEY)
  return {
    configured: cloud || Boolean(HUNYUAN_API_BASE),
    mode: cloud ? 'cloud' : 'local',
    cloud,
    cloudBase: HUNYUAN_CLOUD_BASE,
    model: HUNYUAN_MODEL,
    baseUrl: HUNYUAN_API_BASE,
    createPath: HUNYUAN_CREATE_PATH,
    statusPath: HUNYUAN_STATUS_PATH,
  }
}

/**
 * 创建混元生 3D 任务：有 API Key 走腾讯云 OpenAI 兼容接口，否则走本地服务。
 * Creates a Hunyuan 3D job via Tencent cloud OpenAI-compat API when keyed, else local server.
 */
export async function createHunyuanTask(payload) {
  if (HUNYUAN_API_KEY) return createHunyuanCloudTask(payload)
  return createHunyuanLocalTask(payload)
}

/**
 * 查询混元生 3D 任务状态；按 taskId 前缀区分云端与本地。
 * Polls Hunyuan 3D job status; routes by cloud vs local taskId prefix.
 */
export async function getHunyuanTask(taskId) {
  if (!taskId) {
    throw Object.assign(new Error('taskId is required.'), { status: 400 })
  }

  if (isHunyuanCloudTaskId(taskId)) return getHunyuanCloudTask(taskId)
  return getHunyuanLocalTask(taskId)
}

/**
 * 构建云端 submit 请求体（有图时不传 Prompt，符合官方互斥约束）。
 * Builds cloud submit body (omit Prompt when image is present per official mutual exclusion).
 */
export function buildHunyuanCloudSubmitBody(payload = {}) {
  const multiViewImages = Array.isArray(payload.multiViewImages) ? payload.multiViewImages : []
  const defaultModel = multiViewImages.length ? '3.1' : HUNYUAN_MODEL

  if (payload.imageDataUrl) {
    // 前端传来的是 data URL；腾讯 ImageUrl 只接受 http(s)，本地图必须走 ImageBase64。
    // Frontend sends a data URL; Tencent ImageUrl only accepts http(s), so use ImageBase64.
    const image = parseDataUrl(payload.imageDataUrl)
    return buildHunyuanCloudSubmitFields(payload, {
      defaultModel,
      imageBase64: image.buffer.toString('base64'),
      multiViewImages,
    })
  }

  return buildHunyuanCloudSubmitFields(payload, { defaultModel, multiViewImages })
}

async function createHunyuanCloudTask(payload) {
  const multiViewImages = Array.isArray(payload.multiViewImages) ? payload.multiViewImages : []
  if (!payload?.imageDataUrl && !payload?.prompt && !multiViewImages.length) {
    throw Object.assign(new Error('Hunyuan cloud submit requires an image, multi-view images, or a prompt.'), { status: 400 })
  }

  const requestBody = buildHunyuanCloudSubmitBody(payload)
  const raw = await hunyuanCloudRequest('/v1/ai3d/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })
  const data = unwrapHunyuanCloudPayload(raw)
  const jobId = findFirstValue(data, ['JobId', 'jobId', 'job_id', 'id'])

  if (!jobId) {
    const error = new Error('Hunyuan cloud submit did not return a JobId.')
    error.detail = sanitizeHunyuanRaw(raw)
    throw error
  }

  return {
    provider: 'hunyuan',
    taskId: encodeHunyuanCloudTaskId(jobId),
    status: 'queued',
    mode: 'cloud',
    raw: sanitizeHunyuanRaw(raw),
  }
}

async function getHunyuanCloudTask(taskId) {
  const jobId = decodeHunyuanCloudTaskId(taskId)
  const cacheId = taskId

  if (await hasLocalModel(cacheId, 'glb')) {
    return {
      provider: 'hunyuan',
      taskId,
      status: 'success',
      progress: 100,
      modelUrl: localModelUrl(cacheId, 'glb'),
      rawModelUrl: '',
      error: '',
      mode: 'cloud',
      raw: { cached: true },
    }
  }

  const raw = await hunyuanCloudRequest('/v1/ai3d/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ JobId: jobId }),
  })
  const data = unwrapHunyuanCloudPayload(raw)
  const status = inferHunyuanCloudStatus(data)
  let modelUrl = ''
  let rawModelUrl = ''
  let cacheError = ''

  if (status === 'success') {
    const glb = findHunyuanGlbResult(data.ResultFile3Ds || data.resultFile3Ds || data.ResultFiles)
    if (!glb?.url) {
      cacheError = 'Hunyuan cloud result did not include a GLB file. Only OBJ/other formats were returned.'
    } else {
      rawModelUrl = glb.url
      try {
        modelUrl = await cacheRemoteModelAs(cacheId, rawModelUrl, 'glb')
      } catch (error) {
        cacheError = error.message || 'Hunyuan cloud model cache failed.'
        modelUrl = `/api/3d/model?url=${encodeURIComponent(rawModelUrl)}`
      }
    }
  }

  const errorMessage = String(data.ErrorMessage || data.errorMessage || '').trim()
    || (typeof data.error === 'string' ? data.error : '')
    || cacheError
    || ''

  return {
    provider: 'hunyuan',
    taskId,
    status: status === 'success' && !modelUrl && cacheError ? 'failed' : status,
    progress: getHunyuanCloudProgress(status === 'success' && !modelUrl && cacheError ? 'failed' : status, data),
    modelUrl,
    rawModelUrl,
    error: errorMessage,
    mode: 'cloud',
    cloudStatus: data.Status || data.status || '',
    raw: sanitizeHunyuanRaw(raw),
  }
}

async function createHunyuanLocalTask(payload) {
  const image = parseDataUrl(payload.imageDataUrl)
  const imageBase64 = image.buffer.toString('base64')
  const requestBody = {
    image: `data:${image.mime};base64,${imageBase64}`,
    image_base64: imageBase64,
    prompt: payload.prompt || '',
    seed: payload.seed ?? 1234,
    remove_background: payload.removeBackground ?? true,
    texture: payload.texture ?? true,
    pbr: payload.pbr ?? true,
    octree_resolution: payload.octreeResolution ?? 256,
    num_inference_steps: payload.numInferenceSteps ?? 50,
    guidance_scale: payload.guidanceScale ?? 5.5,
    face_count: payload.faceCount ?? 60000,
  }

  const raw = await hunyuanLocalRequest(HUNYUAN_CREATE_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })
  const data = raw.data || raw
  const taskId = findFirstValue(data, ['uid', 'task_id', 'taskId', 'id']) || `hunyuan-${Date.now()}`
  const rawModelUrl = findModelUrl(data)
  const modelBase64 = findFirstValue(data, ['model_base64', 'modelBase64', 'glb_base64', 'glbBase64'])
  let modelUrl = rawModelUrl ? `/api/3d/model?url=${encodeURIComponent(rawModelUrl)}` : ''

  if (modelBase64) {
    await saveLocalModel(taskId, modelBase64, 'glb')
    modelUrl = localModelUrl(taskId, 'glb')
  }

  return {
    provider: 'hunyuan',
    taskId,
    status: modelUrl ? 'success' : 'queued',
    mode: 'local',
    modelUrl,
    raw: sanitizeHunyuanRaw(raw),
  }
}

async function getHunyuanLocalTask(taskId) {
  if (await hasLocalModel(taskId, 'glb')) {
    return {
      provider: 'hunyuan',
      taskId,
      status: 'success',
      progress: 100,
      modelUrl: localModelUrl(taskId, 'glb'),
      rawModelUrl: '',
      error: '',
      mode: 'local',
      raw: {},
    }
  }

  const raw = await hunyuanLocalRequest(`${HUNYUAN_STATUS_PATH}/${encodeURIComponent(taskId)}`, { method: 'GET' })
  const data = raw.data || raw
  const status = normalizeHunyuanStatus(data.status || data.task_status || data.state || data.message || 'running')
  const progress = data.progress ?? data.percent ?? null
  const rawModelUrl = findModelUrl(data)
  const modelBase64 = findFirstValue(data, ['model_base64', 'modelBase64', 'glb_base64', 'glbBase64'])
  let modelUrl = rawModelUrl ? `/api/3d/model?url=${encodeURIComponent(rawModelUrl)}` : ''

  if (modelBase64) {
    await saveLocalModel(taskId, modelBase64, 'glb')
    modelUrl = localModelUrl(taskId, 'glb')
  }

  return {
    provider: 'hunyuan',
    taskId,
    status,
    progress,
    modelUrl,
    rawModelUrl,
    error: data.error || data.message || '',
    mode: 'local',
    raw: sanitizeHunyuanRaw(raw),
  }
}

/**
 * 调用腾讯混元生 3D OpenAI 兼容 HTTP 接口。
 * Calls the Tencent Hunyuan AI3D OpenAI-compatible HTTP API.
 */
async function hunyuanCloudRequest(requestPath, options = {}) {
  const base = HUNYUAN_CLOUD_BASE.replace(/\/$/, '')
  const path = requestPath.startsWith('/') ? requestPath : `/${requestPath}`
  let response

  try {
    response = await hunyuanCloudFetch(base, path, options, formatHunyuanAuthHeader(HUNYUAN_API_KEY))
    if (response.status === 401 || response.status === 403) {
      response = await hunyuanCloudFetch(base, path, options, `Bearer ${String(HUNYUAN_API_KEY).trim()}`)
    }
  } catch (error) {
    const wrapped = new Error(`Hunyuan cloud request failed: ${error.message}`)
    wrapped.detail = {
      path: requestPath,
      cause: error.cause?.message || error.cause?.code || error.message,
      proxy: hasOutboundProxy(),
    }
    throw wrapped
  }

  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text || 'Non-JSON response from Hunyuan cloud.' }
  }

  if (!response.ok || (data.error && typeof data.error === 'object') || data.Response?.Error) {
    const message = extractHunyuanCloudErrorMessage(data, response.status)
    const error = new Error(message)
    error.status = response.status || 502
    error.detail = sanitizeHunyuanRaw(data)
    throw error
  }

  return data
}

/**
 * 向腾讯混元 OpenAI 兼容接口发送一次 HTTP 请求。
 * Sends one HTTP request to the Tencent Hunyuan OpenAI-compatible API.
 */
function hunyuanCloudFetch(base, path, options, authorization) {
  return undiciFetch(`${base}${path}`, {
    ...options,
    ...(OUTBOUND_PROXY_AGENT ? { dispatcher: OUTBOUND_PROXY_AGENT } : {}),
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  })
}

function unwrapHunyuanCloudPayload(raw) {
  if (!raw || typeof raw !== 'object') return {}
  return raw.Response || raw.data || raw.result || raw
}

async function hunyuanLocalRequest(requestPath, options = {}) {
  let response
  try {
    response = await undiciFetch(`${HUNYUAN_API_BASE.replace(/\/$/, '')}${requestPath.startsWith('/') ? requestPath : `/${requestPath}`}`, options)
  } catch (error) {
    const wrapped = new Error(`Hunyuan3D local server unavailable at ${HUNYUAN_API_BASE}. Start the local Hunyuan3D API server, set HUNYUAN_API_KEY for cloud, or switch provider.`)
    wrapped.detail = {
      path: requestPath,
      cause: error.cause?.message || error.cause?.code || error.message,
    }
    throw wrapped
  }

  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text || 'Non-JSON response from Hunyuan3D.' }
  }

  if (!response.ok || (typeof data.code === 'number' && data.code !== 0)) {
    const error = new Error(data.message || data.error || `Hunyuan3D request failed with ${response.status}.`)
    error.status = response.status || 502
    error.detail = sanitizeHunyuanRaw(data)
    throw error
  }

  return data
}

function sanitizeHunyuanRaw(raw) {
  if (!raw || typeof raw !== 'object') return raw
  return JSON.parse(JSON.stringify(raw, (key, value) => {
    if (['model_base64', 'modelBase64', 'glb_base64', 'glbBase64', 'Url', 'url'].includes(key) && typeof value === 'string' && value.startsWith('data:')) {
      return '[data-url omitted]'
    }
    if (['model_base64', 'modelBase64', 'glb_base64', 'glbBase64'].includes(key)) return '[base64 omitted]'
    return value
  }))
}
