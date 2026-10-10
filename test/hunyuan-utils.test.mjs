import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
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
  normalizeHunyuanMultiViewImages,
} from '../server/providers/hunyuan-utils.mjs'
import { validateMultiViewSlots } from '../src/config/hunyuanMultiView.js'

describe('hunyuan cloud utility functions', () => {
  it('normalizes Hunyuan cloud statuses, task ids, submit bodies, and GLB results', () => {
    assert.equal(normalizeHunyuanCloudStatus('WAIT'), 'queued')
    assert.equal(normalizeHunyuanCloudStatus('RUN'), 'running')
    assert.equal(normalizeHunyuanCloudStatus('DONE'), 'success')
    assert.equal(normalizeHunyuanCloudStatus('FAIL'), 'failed')

    const jobId = '1387416933258346496'
    const encoded = encodeHunyuanCloudTaskId(jobId)
    assert.equal(isHunyuanCloudTaskId(encoded), true)
    assert.equal(isHunyuanCloudTaskId(jobId), false)
    assert.equal(decodeHunyuanCloudTaskId(encoded), jobId)
    assert.equal(formatHunyuanAuthHeader('sk-test-key'), 'sk-test-key')
    assert.equal(formatHunyuanAuthHeader('Bearer sk-test-key'), 'Bearer sk-test-key')

    const withImage = buildHunyuanCloudSubmitFields(
      { prompt: 'should-not-appear', pbr: true },
      { defaultModel: '3.0', imageDataUrl: 'data:image/png;base64,abc123' },
    )
    assert.equal(withImage.Model, '3.0')
    assert.equal(withImage.EnablePBR, true)
    assert.equal(withImage.ImageBase64, 'abc123')
    assert.equal('ImageUrl' in withImage, false)
    assert.equal('Prompt' in withImage, false)

    const withHttp = buildHunyuanCloudSubmitFields(
      {},
      { defaultModel: '3.0', imageUrl: 'https://cdn.example.com/input.png' },
    )
    assert.equal(withHttp.ImageUrl, 'https://cdn.example.com/input.png')
    assert.equal('ImageBase64' in withHttp, false)

    assert.equal(
      extractHunyuanCloudErrorMessage({ Type: 2, Code: 1001, Msg: 'Invalid param', Desc: '' }, 400),
      '1001: Invalid param',
    )
    assert.equal(
      extractHunyuanCloudErrorMessage({
        Response: { Error: { Code: 'InvalidParameterValue.UrlIllegal', Message: 'URL格式不合法。' } },
      }, 200),
      'InvalidParameterValue.UrlIllegal: URL格式不合法。',
    )

    const withPrompt = buildHunyuanCloudSubmitFields({ prompt: '一只小猫' }, { defaultModel: '3.1' })
    assert.equal(withPrompt.Model, '3.1')
    assert.equal(withPrompt.Prompt, '一只小猫')
    assert.equal('ImageUrl' in withPrompt, false)
    assert.equal('ImageBase64' in withPrompt, false)

    assert.deepEqual(
      findHunyuanGlbResult([
        { Type: 'OBJ', Url: 'https://cdn.example.com/model.zip', PreviewImageUrl: 'https://cdn.example.com/preview.png' },
        { Type: 'GLB', Url: 'https://cdn.example.com/model.glb', PreviewImageUrl: 'https://cdn.example.com/preview.png' },
      ]),
      {
        url: 'https://cdn.example.com/model.glb',
        type: 'GLB',
        previewImageUrl: 'https://cdn.example.com/preview.png',
      },
    )
    assert.equal(findHunyuanGlbResult([{ Type: 'OBJ', Url: 'https://cdn.example.com/model.zip' }]), null)

    assert.equal(inferHunyuanCloudStatus({ Status: 'RUN' }), 'running')
    assert.equal(inferHunyuanCloudStatus({ Status: 'DONE', ResultFile3Ds: [{ Type: 'GLB', Url: 'https://cdn.example.com/a.glb' }] }), 'success')
    assert.equal(
      inferHunyuanCloudStatus({
        ResultFile3Ds: [
          { Type: 'OBJ', Url: 'https://cdn.example.com/a.zip' },
          { Type: 'GLB', Url: 'https://cdn.example.com/a.glb' },
        ],
      }),
      'success',
    )
    assert.equal(inferHunyuanCloudStatus({ Status: 'FAIL', ErrorCode: 'FailedOperation', ErrorMessage: 'failed' }), 'failed')
    assert.equal(getHunyuanCloudProgress('running'), 45)
    assert.equal(getHunyuanCloudProgress('queued'), 10)
    assert.equal(getHunyuanCloudProgress('success'), 100)

    const withMulti = buildHunyuanCloudSubmitFields(
      { pbr: true, faceCount: 1_500_000 },
      {
        defaultModel: '3.0',
        imageBase64: 'primarybase64',
        multiViewImages: [
          { ViewType: 'left', ViewImageBase64: 'leftbase64' },
          { viewType: 'back', imageDataUrl: 'data:image/png;base64,backbase64' },
          { ViewType: 'front', ViewImageBase64: 'should-skip' },
        ],
      },
    )
    assert.equal(withMulti.Model, '3.1')
    assert.equal(withMulti.ImageBase64, 'primarybase64')
    assert.equal(withMulti.FaceCount, 1_500_000)
    assert.deepEqual(withMulti.MultiViewImages, [
      { ViewType: 'left', ViewImageBase64: 'leftbase64' },
      { ViewType: 'back', ViewImageBase64: 'backbase64' },
    ])
    assert.deepEqual(
      normalizeHunyuanMultiViewImages([{ ViewType: 'top', ViewImageBase64: 'x' }]),
      [{ ViewType: 'top', ViewImageBase64: 'x' }],
    )
    assert.equal(validateMultiViewSlots({}).ok, false)
    assert.equal(validateMultiViewSlots({ front: {} }).ok, false)
    assert.equal(validateMultiViewSlots({ front: {}, left: {} }).ok, true)
  })
})
