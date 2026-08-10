import { describe, expect, it, vi } from 'vitest'
import captureFrameModule from './captureFrame'
import type { DrawingSurface } from './captureFrame'

const { captureFrame } = captureFrameModule

const video = (width: number, height: number): HTMLVideoElement => {
  const element = document.createElement('video')

  Object.defineProperty(element, 'videoWidth', { value: width })
  Object.defineProperty(element, 'videoHeight', { value: height })

  return element
}

const surface = (
  overrides: Partial<DrawingSurface> = {},
): DrawingSurface & { drawn: number[][] } => {
  const drawn: number[][] = []

  return {
    drawn,
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (_, x, y, width, height) => {
        drawn.push([x, y, width, height])
      },
    }),
    toDataURL: () => 'data:image/jpeg;base64,frame',
    ...overrides,
  }
}

describe('captureFrame', () => {
  it('takes a still of the current frame', () => {
    expect(captureFrame(video(1920, 1080), surface())).toBe('data:image/jpeg;base64,frame')
  })

  it('draws at the size the video actually is', () => {
    const canvas = surface()

    captureFrame(video(1920, 1080), canvas)

    expect(canvas.width).toBe(1920)
    expect(canvas.height).toBe(1080)
    expect(canvas.drawn).toEqual([[0, 0, 1920, 1080]])
  })

  it('answers with nothing when no frame has been decoded yet', () => {
    const canvas = surface()

    expect(captureFrame(video(0, 0), canvas)).toBeNull()
    expect(canvas.drawn).toHaveLength(0)
  })

  it('answers with nothing when the browser gives no drawing context', () => {
    expect(captureFrame(video(1920, 1080), surface({ getContext: () => null }))).toBeNull()
  })

  it('answers with nothing rather than throwing when the frame cannot be read', () => {
    const refuses = surface({
      toDataURL: () => {
        throw new Error('The canvas has been tainted by cross-origin data.')
      },
    })

    expect(captureFrame(video(1920, 1080), refuses)).toBeNull()
  })

  it('asks for a still small enough to hold in memory', () => {
    const quality = vi.fn(() => 'data:image/jpeg;base64,frame')

    captureFrame(video(1920, 1080), surface({ toDataURL: quality }))

    expect(quality).toHaveBeenCalledWith('image/jpeg', 0.7)
  })
})
