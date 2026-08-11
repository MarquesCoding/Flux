import { describe, expect, it } from 'vitest'
import describePlaybackAxisModule from './describePlaybackAxis'
import type { AudioDecision, Reason, VideoDecision } from '@FluxContracts/schemas/PlaybackPlan'

const { describeAxis, describeVideoAxis, describeAudioAxis } = describePlaybackAxisModule

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' }

describe('describeAxis', () => {
  it('joins the decision and its reason', () => {
    expect(describeAxis('passthrough', 'Client declares support')).toBe(
      'passthrough — Client declares support',
    )
  })
})

describe('describeVideoAxis', () => {
  it('describes a passthrough without any numbers', () => {
    const video: VideoDecision = { kind: 'passthrough', reason }

    expect(describeVideoAxis(video)).toBe('passthrough — Client declares support')
  })

  it('describes a transcode with the resolution and bitrate ceiling', () => {
    const video: VideoDecision = {
      kind: 'transcode',
      codec: 'h264',
      range: 'SDR',
      maxBitrateKbps: 8000,
      maxWidth: 1920,
      maxHeight: 1080,
      reason: { code: 'VideoCodecNotSupported', detail: 'Client does not support hevc' },
    }

    expect(describeVideoAxis(video)).toBe(
      'transcode — Client does not support hevc (1920x1080 @ 8000kbps)',
    )
  })
})

describe('describeAudioAxis', () => {
  it('describes a passthrough without any numbers', () => {
    const audio: AudioDecision = { kind: 'passthrough', streamIndex: 1, reason }

    expect(describeAudioAxis(audio)).toBe('passthrough — Client declares support')
  })

  it('describes a transcode with the bitrate ceiling', () => {
    const audio: AudioDecision = {
      kind: 'transcode',
      streamIndex: 1,
      codec: 'aac',
      channels: 2,
      maxBitrateKbps: 192,
      reason: { code: 'AudioCodecNotSupported', detail: 'Client does not support truehd' },
    }

    expect(describeAudioAxis(audio)).toBe('transcode — Client does not support truehd (192kbps)')
  })
})
