/**
 * 混元多视图槽位定义（正图为主图 ImageBase64，其余进 MultiViewImages）。
 * Hunyuan multi-view slot definitions (front -> ImageBase64, others -> MultiViewImages).
 */
export const HUNYUAN_MULTI_VIEW_SLOTS = [
  { id: 'front', viewType: null, labelEn: 'Front', labelZh: '正图', required: true, apiRole: 'primary' },
  { id: 'left_front', viewType: 'left_front', labelEn: 'Left 45°', labelZh: '左45°', required: false, apiRole: 'multi' },
  { id: 'right_front', viewType: 'right_front', labelEn: 'Right 45°', labelZh: '右45°', required: false, apiRole: 'multi' },
  { id: 'left', viewType: 'left', labelEn: 'Left', labelZh: '左图', required: false, apiRole: 'multi' },
  { id: 'right', viewType: 'right', labelEn: 'Right', labelZh: '右图', required: false, apiRole: 'multi' },
  { id: 'back', viewType: 'back', labelEn: 'Back', labelZh: '背图', required: false, apiRole: 'multi' },
  { id: 'top', viewType: 'top', labelEn: 'Top', labelZh: '顶图', required: false, apiRole: 'multi' },
  { id: 'bottom', viewType: 'bottom', labelEn: 'Bottom', labelZh: '底图', required: false, apiRole: 'multi' },
]

export const HUNYUAN_MULTI_VIEW_MIN_IMAGES = 2
export const HUNYUAN_MULTI_VIEW_MAX_IMAGES = 8
export const HUNYUAN_MULTI_VIEW_MODEL = '3.1'

/**
 * 模型面数选项，对应官方 FaceCount（OpenAI 兼容 submit 直接传 FaceCount）。
 * Face-count presets mapped to official FaceCount for OpenAI-compat submit.
 */
export const HUNYUAN_FACE_COUNT_OPTIONS = [
  { id: '1.5m', label: '1.5m', value: 1_500_000 },
  { id: '1m', label: '1m', value: 1_000_000 },
  { id: '500k', label: '500k', value: 500_000 },
  { id: '50k', label: '50k', value: 50_000 },
]

export const HUNYUAN_DEFAULT_FACE_COUNT = HUNYUAN_FACE_COUNT_OPTIONS[0].value

/**
 * 统计已上传槽位数量。
 * Counts filled multi-view slots.
 */
export function countFilledMultiViewSlots(slotFiles = {}) {
  return HUNYUAN_MULTI_VIEW_SLOTS.filter((slot) => Boolean(slotFiles[slot.id])).length
}

/**
 * 校验多视图上传是否满足最少张数且含正图。
 * Validates multi-view upload has front image and meets min count.
 */
export function validateMultiViewSlots(slotFiles = {}) {
  if (!slotFiles.front) {
    return { ok: false, message: 'Front view is required for multi-view generation.' }
  }
  const filled = countFilledMultiViewSlots(slotFiles)
  if (filled < HUNYUAN_MULTI_VIEW_MIN_IMAGES) {
    return {
      ok: false,
      message: `Upload at least ${HUNYUAN_MULTI_VIEW_MIN_IMAGES} views (front + one more).`,
    }
  }
  if (filled > HUNYUAN_MULTI_VIEW_MAX_IMAGES) {
    return {
      ok: false,
      message: `At most ${HUNYUAN_MULTI_VIEW_MAX_IMAGES} views are allowed.`,
    }
  }
  return { ok: true, message: '' }
}
