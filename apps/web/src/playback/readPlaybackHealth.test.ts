import { describe, expect, it } from 'vitest'
import { readPlaybackHealth, encodedSeconds, bufferedAhead } from './readPlaybackHealth'

type Range = { start: number; end: number }

const ranges = (entries: Range[]) => ({
  length: entries.length,
  start: (index: number) => entries[index]?.start ?? 0,
  end: (index: number) => entries[index]?.end ?? 0,
})

const player = (options: {
  currentTime?: number
  seekable?: Range[]
  buffered?: Range[]
  width?: number
  height?: number
  quality?: { droppedVideoFrames: number; totalVideoFrames: number }
}): HTMLVideoElement => {
  const element = document.createElement('video')

  Object.defineProperty(element, 'currentTime', { value: options.currentTime ?? 0 })
  Object.defineProperty(element, 'seekable', { value: ranges(options.seekable ?? []) })
  Object.defineProperty(element, 'buffered', { value: ranges(options.buffered ?? []) })
  Object.defineProperty(element, 'videoWidth', { value: options.width ?? 0 })
  Object.defineProperty(element, 'videoHeight', { value: options.height ?? 0 })

  if (options.quality !== undefined) {
    Object.defineProperty(element, 'getVideoPlaybackQuality', {
      value: () => ({
        creationTime: 0,
        droppedVideoFrames: options.quality?.droppedVideoFrames ?? 0,
        totalVideoFrames: options.quality?.totalVideoFrames ?? 0,
        corruptedVideoFrames: 0,
      }),
    })
  }

  return element
}

describe('encodedSeconds', () => {
  it('reports how far the stream reaches', () => {
    expect(encodedSeconds(player({ seekable: [{ start: 0, end: 240 }] }))).toBe(240)
  })

  it('reports nothing before anything has loaded', () => {
    expect(encodedSeconds(player({}))).toBe(0)
  })
})

describe('bufferedAhead', () => {
  it('measures from where the viewer is to the end of their range', () => {
    const element = player({ currentTime: 10, buffered: [{ start: 0, end: 40 }] })

    expect(bufferedAhead(element)).toBe(30)
  })

  it('ignores a range the viewer is not inside, because a gap will stall', () => {
    const element = player({
      currentTime: 10,
      buffered: [
        { start: 0, end: 12 },
        { start: 60, end: 120 },
      ],
    })

    expect(bufferedAhead(element)).toBe(2)
  })

  it('reports nothing when the viewer is in a gap', () => {
    const element = player({ currentTime: 30, buffered: [{ start: 60, end: 120 }] })

    expect(bufferedAhead(element)).toBe(0)
  })
})

describe('readPlaybackHealth', () => {
  it('reports the position on the film, not inside the session', () => {
    const health = readPlaybackHealth(player({ currentTime: 12 }), 3600)

    expect(health.positionSeconds).toBe(3612)
  })

  it('reports the size actually being decoded', () => {
    const health = readPlaybackHealth(player({ width: 1920, height: 1040 }), 0)

    expect(health).toMatchObject({ presentedWidth: 1920, presentedHeight: 1040 })
  })

  it('reports frame counts where the browser keeps them', () => {
    const health = readPlaybackHealth(
      player({ quality: { droppedVideoFrames: 4, totalVideoFrames: 900 } }),
      0,
    )

    expect(health).toMatchObject({ droppedFrames: 4, decodedFrames: 900 })
  })

  it('says nothing rather than zero when the browser does not count frames', () => {
    const health = readPlaybackHealth(player({}), 0)

    expect(health).toMatchObject({ droppedFrames: null, decodedFrames: null })
  })
})
