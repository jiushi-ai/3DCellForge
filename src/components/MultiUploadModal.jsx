import { useMemo, useRef, useState } from 'react'
import { Images, Upload, X } from 'lucide-react'

import {
  HUNYUAN_DEFAULT_FACE_COUNT,
  HUNYUAN_FACE_COUNT_OPTIONS,
  HUNYUAN_MULTI_VIEW_MAX_IMAGES,
  HUNYUAN_MULTI_VIEW_MIN_IMAGES,
  HUNYUAN_MULTI_VIEW_SLOTS,
  countFilledMultiViewSlots,
  validateMultiViewSlots,
} from '../config/hunyuanMultiView.js'
import multiViewDemo from '../assets/mutldemo.webp'

/** 各槽位到中心示意模型的连线端点（viewBox 0–100）。 / Slot-to-demo ray endpoints in viewBox 0–100. */
const MULTI_VIEW_RAYS = [
  { id: 'top', x: 50, y: 7 },
  { id: 'left_front', x: 17, y: 24 },
  { id: 'front', x: 50, y: 24 },
  { id: 'right_front', x: 83, y: 24 },
  { id: 'left', x: 14, y: 48 },
  { id: 'right', x: 86, y: 48 },
  { id: 'back', x: 50, y: 72 },
  { id: 'bottom', x: 50, y: 92 },
]
const MULTI_VIEW_RAY_CENTER = { x: 50, y: 48 }

const SLOT_BY_ID = Object.fromEntries(HUNYUAN_MULTI_VIEW_SLOTS.map((slot) => [slot.id, slot]))

/**
 * 混元多视图上传弹层：官网式空间布局 + 模型面数 FaceCount。
 * Hunyuan multi-view modal with spatial layout and FaceCount control.
 */
export function MultiUploadModal({ open, onClose, onSubmit, busy = false }) {
  const [slotFiles, setSlotFiles] = useState({})
  const [slotPreviews, setSlotPreviews] = useState({})
  const [faceCount, setFaceCount] = useState(HUNYUAN_DEFAULT_FACE_COUNT)
  const [error, setError] = useState('')
  const activeSlotRef = useRef('front')
  const fileInputRef = useRef(null)

  const filledCount = useMemo(() => countFilledMultiViewSlots(slotFiles), [slotFiles])

  if (!open) return null

  function openPicker(slotId) {
    activeSlotRef.current = slotId
    fileInputRef.current?.click()
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    const slotId = activeSlotRef.current
    event.target.value = ''
    if (!file || !slotId) return

    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setError('Only PNG, JPEG, or WebP images are supported.')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setSlotFiles((current) => ({ ...current, [slotId]: file }))
    setSlotPreviews((current) => {
      if (current[slotId]) URL.revokeObjectURL(current[slotId])
      return { ...current, [slotId]: previewUrl }
    })
    setError('')
  }

  function clearSlot(slotId) {
    setSlotFiles((current) => {
      const next = { ...current }
      delete next[slotId]
      return next
    })
    setSlotPreviews((current) => {
      if (current[slotId]) URL.revokeObjectURL(current[slotId])
      const next = { ...current }
      delete next[slotId]
      return next
    })
  }

  async function handleSubmit() {
    const validation = validateMultiViewSlots(slotFiles)
    if (!validation.ok) {
      setError(validation.message)
      return
    }
    setError('')
    await onSubmit?.(slotFiles, { faceCount })
  }

  function handleClose() {
    Object.values(slotPreviews).forEach((url) => URL.revokeObjectURL(url))
    setSlotFiles({})
    setSlotPreviews({})
    setFaceCount(HUNYUAN_DEFAULT_FACE_COUNT)
    setError('')
    onClose?.()
  }

  function renderSlot(slotId, extraClass = '') {
    const slot = SLOT_BY_ID[slotId]
    if (!slot) return null
    return (
      <div className={`multi-upload-slot slot-${slot.id} ${extraClass}`.trim()}>
        <button
          type="button"
          className={slotPreviews[slot.id] ? 'multi-upload-card filled' : 'multi-upload-card'}
          onClick={() => openPicker(slot.id)}
          disabled={busy}
          title={`Upload ${slot.labelEn}`}
        >
          {slotPreviews[slot.id] ? (
            <img src={slotPreviews[slot.id]} alt={slot.labelEn} />
          ) : (
            <span className="multi-upload-placeholder">
              <Upload size={14} />
              <em>上传{slot.labelZh}</em>
            </span>
          )}
        </button>
        <div className="multi-upload-slot-meta">
          <span>{slot.labelZh} / {slot.labelEn}{slot.required ? ' *' : ''}</span>
          {slotFiles[slot.id] ? (
            <button type="button" className="multi-upload-clear" onClick={() => clearSlot(slot.id)} disabled={busy}>
              Clear
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="multi-upload-overlay" role="dialog" aria-modal="true" aria-label="Multi-view upload">
      <div className="multi-upload-modal">
        <header className="multi-upload-header">
          <div>
            <strong>添加多视图 / Add Multi-view</strong>
            <small>
              Hunyuan · Min {HUNYUAN_MULTI_VIEW_MIN_IMAGES} · Max {HUNYUAN_MULTI_VIEW_MAX_IMAGES} · Model 3.1
            </small>
          </div>
          <button type="button" className="multi-upload-close" onClick={handleClose} disabled={busy} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="multi-upload-toolbar">
          <span>模型面数 / Face Count</span>
          <div className="multi-upload-face-count" role="group" aria-label="Face count">
            {HUNYUAN_FACE_COUNT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={faceCount === option.value ? 'active' : ''}
                onClick={() => setFaceCount(option.value)}
                disabled={busy}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="multi-upload-compass" aria-label="Multi-view spatial layout">
          <svg
            className="multi-upload-rays"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {MULTI_VIEW_RAYS.map((ray) => (
              <line
                key={ray.id}
                className={`multi-upload-ray ray-${ray.id}`}
                x1={MULTI_VIEW_RAY_CENTER.x}
                y1={MULTI_VIEW_RAY_CENTER.y}
                x2={ray.x}
                y2={ray.y}
              />
            ))}
          </svg>

          <div className="multi-upload-guide" aria-hidden="true">
            <img className="multi-upload-guide-img" src={multiViewDemo} alt="" />
          </div>

          {renderSlot('top', 'pos-top')}
          {renderSlot('left_front', 'pos-left-front')}
          {renderSlot('front', 'pos-front')}
          {renderSlot('right_front', 'pos-right-front')}
          {renderSlot('left', 'pos-left')}
          {renderSlot('right', 'pos-right')}
          {renderSlot('back', 'pos-back')}
          {renderSlot('bottom', 'pos-bottom')}
        </div>

        <footer className="multi-upload-footer">
          <small>{filledCount} / {HUNYUAN_MULTI_VIEW_MAX_IMAGES} views selected · FaceCount {faceCount.toLocaleString()}</small>
          {error ? <p className="multi-upload-error">{error}</p> : null}
          <div className="multi-upload-actions">
            <button type="button" className="drawer-secondary" onClick={handleClose} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="drawer-primary" onClick={handleSubmit} disabled={busy}>
              <Images size={14} />
              {busy ? 'Submitting…' : 'Generate Multi-view'}
            </button>
          </div>
        </footer>

        <input
          ref={fileInputRef}
          className="hidden-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          onChange={handleFileChange}
        />
      </div>
    </div>
  )
}
