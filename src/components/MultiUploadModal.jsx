import { useMemo, useRef, useState } from 'react'
import { Images, Upload, X } from 'lucide-react'

import {
  HUNYUAN_MULTI_VIEW_MAX_IMAGES,
  HUNYUAN_MULTI_VIEW_MIN_IMAGES,
  HUNYUAN_MULTI_VIEW_SLOTS,
  countFilledMultiViewSlots,
  validateMultiViewSlots,
} from '../config/hunyuanMultiView.js'

/**
 * 混元多视图上传弹层：按正/侧/背/顶等槽位选图后提交。
 * Hunyuan multi-view upload modal: pick angled slots then submit.
 */
export function MultiUploadModal({ open, onClose, onSubmit, busy = false }) {
  const [slotFiles, setSlotFiles] = useState({})
  const [slotPreviews, setSlotPreviews] = useState({})
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
    setSlotFiles((current) => {
      const next = { ...current, [slotId]: file }
      return next
    })
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
    await onSubmit?.(slotFiles)
  }

  function handleClose() {
    Object.values(slotPreviews).forEach((url) => URL.revokeObjectURL(url))
    setSlotFiles({})
    setSlotPreviews({})
    setError('')
    onClose?.()
  }

  return (
    <div className="multi-upload-overlay" role="dialog" aria-modal="true" aria-label="Multi-view upload">
      <div className="multi-upload-modal">
        <header className="multi-upload-header">
          <div>
            <strong>Add Multi-view</strong>
            <small>
              Hunyuan only · Min {HUNYUAN_MULTI_VIEW_MIN_IMAGES} · Max {HUNYUAN_MULTI_VIEW_MAX_IMAGES} · Model 3.1
            </small>
          </div>
          <button type="button" className="multi-upload-close" onClick={handleClose} disabled={busy} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="multi-upload-stage">
          {HUNYUAN_MULTI_VIEW_SLOTS.map((slot) => (
            <div key={slot.id} className={`multi-upload-slot slot-${slot.id}`}>
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
          ))}
        </div>

        <footer className="multi-upload-footer">
          <small>{filledCount} / {HUNYUAN_MULTI_VIEW_MAX_IMAGES} views selected</small>
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
