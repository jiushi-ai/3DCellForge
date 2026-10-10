const CLOUD_TASK_PREFIX = 'hycloud-'

/**
 * 映射腾讯云任务状态到应用统一状态。
 * Maps Tencent cloud job status to the app's shared status vocabulary.
 */
export function normalizeHunyuanCloudStatus(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'DONE' || value === 'SUCCESS') return 'success'
  if (value === 'FAIL' || value === 'FAILED' || value === 'ERROR') return 'failed'
  if (value === 'WAIT' || value === 'PENDING' || value === 'QUEUED') return 'queued'
  if (value === 'RUN' || value === 'RUNNING') return 'running'
  if (!value) return ''
  return normalizeHunyuanStatus(status)
}

/**
 * 综合 Status / ErrorCode / ResultFile3Ds 推断云端任务状态。
 * Status 缺失但已有 GLB/结果文件时视为成功，避免前端一直 running。
 * Infers cloud job status from Status, ErrorCode, and ResultFile3Ds.
 */
export function inferHunyuanCloudStatus(data = {}) {
  const errorCode = String(data.ErrorCode || data.errorCode || '').trim()
  const errorMessage = String(data.ErrorMessage || data.errorMessage || '').trim()
  const files = data.ResultFile3Ds || data.resultFile3Ds || data.ResultFiles || []
  const hasFiles = Array.isArray(files) && files.length > 0
  const hasGlb = Boolean(findHunyuanGlbResult(files))
  const mapped = normalizeHunyuanCloudStatus(data.Status || data.status || data.task_status || data.state)

  if (errorCode || (mapped === 'failed')) return 'failed'
  if (mapped === 'success' || hasGlb) return 'success'
  if (mapped === 'queued' || mapped === 'running') return mapped
  // Status 偶发缺失：已有结果文件按成功；否则按排队，避免误判成永久 running。
  if (hasFiles) return 'success'
  if (!mapped) return 'queued'
  return mapped
}

/**
 * 为云端任务提供可读进度，避免 UI 长时间停在 0%。
 * Provides readable progress for cloud jobs so the UI is not stuck at 0%.
 */
export function getHunyuanCloudProgress(status, data = {}) {
  if (status === 'success') return 100
  if (status === 'failed') return null
  if (status === 'queued') return 10
  if (status === 'running') {
    const consumed = Number(data.ResultCreditConsumed)
    if (Number.isFinite(consumed) && consumed > 0) return 60
    return 45
  }
  return null
}

/**
 * 归一化本地 Hunyuan 状态字符串。
 * Normalizes local Hunyuan status strings.
 */
export function normalizeHunyuanStatus(status) {
  const value = String(status || '').toLowerCase()
  if (['success', 'succeeded', 'completed', 'complete', 'done', 'finish', 'finished'].includes(value)) return 'success'
  if (['failed', 'error', 'cancelled', 'canceled', 'fail'].includes(value)) return 'failed'
  if (['queued', 'pending', 'waiting', 'wait'].includes(value)) return 'queued'
  return 'running'
}

/**
 * 从 ResultFile3Ds 中优先选取 GLB 文件条目。
 * Prefers a GLB entry from ResultFile3Ds for the Three.js viewer.
 */
export function findHunyuanGlbResult(resultFile3Ds) {
  const files = Array.isArray(resultFile3Ds) ? resultFile3Ds : []
  const byType = files.find((entry) => String(entry?.Type || entry?.type || '').toUpperCase() === 'GLB' && (entry?.Url || entry?.url))
  if (byType) {
    return {
      url: byType.Url || byType.url,
      type: 'GLB',
      previewImageUrl: byType.PreviewImageUrl || byType.previewImageUrl || '',
    }
  }

  const byUrl = files.find((entry) => /\.glb(?:[?#]|$)/i.test(entry?.Url || entry?.url || ''))
  if (byUrl) {
    return {
      url: byUrl.Url || byUrl.url,
      type: 'GLB',
      previewImageUrl: byUrl.PreviewImageUrl || byUrl.previewImageUrl || '',
    }
  }

  return null
}

/**
 * 判断是否为云端混元任务 ID。
 * Returns whether the task id belongs to the cloud Hunyuan path.
 */
export function isHunyuanCloudTaskId(taskId) {
  return String(taskId || '').startsWith(CLOUD_TASK_PREFIX)
}

/**
 * 编码云端 JobId 为本地 taskId。
 * Encodes a cloud JobId into the local taskId form.
 */
export function encodeHunyuanCloudTaskId(jobId) {
  return `${CLOUD_TASK_PREFIX}${jobId}`
}

/**
 * 从本地 taskId 解码云端 JobId。
 * Decodes the cloud JobId from a local taskId.
 */
export function decodeHunyuanCloudTaskId(taskId) {
  return String(taskId || '').replace(new RegExp(`^${CLOUD_TASK_PREFIX}`), '')
}

/**
 * 从腾讯云 400/错误 JSON 中提取可读信息。
 * Extracts a readable message from Tencent cloud error JSON.
 */
export function extractHunyuanCloudErrorMessage(data, status) {
  if (typeof data === 'string' && data.trim()) return data.slice(0, 500)
  if (!data || typeof data !== 'object') return `Hunyuan cloud request failed with ${status}.`

  const nested = data.Response?.Error
    || (typeof data.error === 'object' && data.error ? data.error : null)
    || data.Error
    || {}
  const code = data.Code ?? data.code ?? nested.Code ?? nested.code
  const msg = data.Msg || data.msg || data.message || data.Message || data.ErrorMessage
    || nested.Message || nested.message || nested.Msg
  const desc = data.Desc || data.desc || data.Description

  const parts = []
  if (typeof data.error === 'string' && data.error.trim()) parts.push(data.error.trim())
  if (code !== undefined && code !== null && String(code).trim()) parts.push(String(code))
  if (typeof msg === 'string' && msg.trim()) parts.push(msg.trim())
  if (typeof desc === 'string' && desc.trim() && desc.trim() !== msg) parts.push(desc.trim())

  if (parts.length) return parts.join(': ')
  return `Hunyuan cloud request failed with ${status}.`
}

/**
 * 格式化 Authorization：官方示例为直接 sk-；已带 Bearer 则原样使用。
 * Formats Authorization: official samples use raw sk-; keep Bearer if already present.
 */
export function formatHunyuanAuthHeader(apiKey) {
  const key = String(apiKey || '').trim()
  if (!key) return ''
  if (/^bearer\s+/i.test(key)) return key
  return key
}

/**
 * 构建云端 submit 请求体核心字段。
 * 本地图用 ImageBase64（原始 base64）；仅公网 http(s) 才用 ImageUrl，避免 UrlIllegal。
 * Builds cloud submit fields. Local images use ImageBase64; ImageUrl only for public http(s) URLs.
 */
export function buildHunyuanCloudSubmitFields(payload = {}, options = {}) {
  const body = {
    Model: payload.model || options.defaultModel || '3.0',
  }

  if (payload.enablePBR !== undefined || payload.pbr !== undefined) {
    body.EnablePBR = Boolean(payload.enablePBR ?? payload.pbr)
  } else {
    body.EnablePBR = true
  }

  if (payload.faceCount !== undefined || payload.FaceCount !== undefined) {
    body.FaceCount = Number(payload.faceCount ?? payload.FaceCount)
  }

  if (payload.generateType || payload.GenerateType) {
    body.GenerateType = payload.generateType || payload.GenerateType
  }

  const imageBase64 = options.imageBase64 || extractBase64FromDataUrl(options.imageDataUrl)
  const publicImageUrl = options.imageUrl || extractHttpUrl(options.imageDataUrl)
  const multiViewImages = normalizeHunyuanMultiViewImages(options.multiViewImages || payload.multiViewImages)

  if (imageBase64) {
    body.ImageBase64 = imageBase64
  } else if (publicImageUrl) {
    body.ImageUrl = publicImageUrl
  } else if (payload.prompt && !multiViewImages.length) {
    body.Prompt = String(payload.prompt)
  }

  if (multiViewImages.length) {
    body.MultiViewImages = multiViewImages
    // 多视图需 3.1；官方：top/bottom/left_front/right_front 仅 3.1。
    // Multi-view needs 3.1; top/bottom/45° views are 3.1-only.
    if (!payload.model && !options.defaultModel) body.Model = '3.1'
    else if (String(body.Model) === '3.0') body.Model = '3.1'
  }

  return body
}

/**
 * 规范化 MultiViewImages（ViewType + ViewImageBase64）。
 * Normalizes MultiViewImages entries (ViewType + ViewImageBase64).
 */
export function normalizeHunyuanMultiViewImages(entries) {
  if (!Array.isArray(entries)) return []
  const allowed = new Set(['left', 'right', 'back', 'top', 'bottom', 'left_front', 'right_front'])
  const result = []

  for (const entry of entries) {
    const viewType = String(entry?.ViewType || entry?.viewType || '').trim()
    if (!allowed.has(viewType)) continue

    const rawBase64 = entry?.ViewImageBase64 || entry?.viewImageBase64 || extractBase64FromDataUrl(entry?.imageDataUrl || '')
    if (!rawBase64) continue

    result.push({
      ViewType: viewType,
      ViewImageBase64: rawBase64,
    })
  }

  return result
}

/**
 * 从 data URL 提取原始 base64；非 data URL 返回空。
 * Extracts raw base64 from a data URL; returns empty for non-data URLs.
 */
export function extractBase64FromDataUrl(value) {
  if (typeof value !== 'string') return ''
  const match = value.match(/^data:image\/(?:png|jpe?g|webp);base64,(.+)$/i)
  return match ? match[1] : ''
}

/**
 * 仅接受 http(s) 公网图链作为 ImageUrl。
 * Accepts only http(s) URLs for the ImageUrl field.
 */
export function extractHttpUrl(value) {
  if (typeof value !== 'string') return ''
  return /^https?:\/\//i.test(value.trim()) ? value.trim() : ''
}
