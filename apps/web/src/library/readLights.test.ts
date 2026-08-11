import { afterEach, describe, expect, it, vi } from 'vitest'
import readLightsModule from './readLights'

const { readLights, READ_AT, ZONES } = readLightsModule

/**
 * A canvas that answers with a picture divided into quarters.
 *
 * jsdom draws nothing, so what a frame looks like has to be described. Each
 * read is answered from where it was asked: a red top left, a green top right,
 * a blue bottom left and a white bottom right.
 */
const painted = () => {
  const patch = (left: number, top: number, width: number, height: number) => {
    const colour =
      left < READ_AT / 2 && top < READ_AT / 2
        ? [220, 30, 30]
        : left >= READ_AT / 2 && top < READ_AT / 2
          ? [30, 200, 30]
          : left < READ_AT / 2
            ? [30, 30, 220]
            : [240, 240, 240]

    const data = new Uint8ClampedArray(width * height * 4)

    for (let at = 0; at < data.length; at += 4) {
      data[at] = colour[0] ?? 0
      data[at + 1] = colour[1] ?? 0
      data[at + 2] = colour[2] ?? 0
      data[at + 3] = 255
    }

    return { data, width, height, colorSpace: 'srgb' as const }
  }

  return {
    drawImage: vi.fn(),
    getImageData: vi.fn((left: number, top: number, width: number, height: number) =>
      patch(left, top, width, height),
    ),
  }
}

/**
 * Defined rather than spied on: jsdom draws nothing, so there is no context
 * on it to replace.
 */
const withCanvas = (answer: () => ReturnType<typeof painted> | null) => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: answer,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('readLights', () => {
  it('answers with one light per part of the picture', () => {
    withCanvas(() => painted())

    expect(readLights(document.createElement('img'))).toHaveLength(ZONES.length)
  })

  it('takes each light from the part of the picture it belongs to', () => {
    withCanvas(() => painted())

    const lights = readLights(document.createElement('img'))

    // The corners are read in the order they are written down: top left, top
    // right, bottom left, bottom right, and then the middle.
    expect(lights[0]?.at).toBe(ZONES[0]?.at)
    expect(lights[1]?.at).toBe(ZONES[1]?.at)
  })

  it('says a red corner is red rather than grey', () => {
    withCanvas(() => painted())

    const [first] = readLights(document.createElement('img'))
    const read = /rgb\((\d+) (\d+) (\d+)\)/.exec(first?.color ?? '')

    expect(read).not.toBeNull()
    expect(Number(read?.[1])).toBeGreaterThan(Number(read?.[2]))
    expect(Number(read?.[1])).toBeGreaterThan(Number(read?.[3]))
  })

  it('reads at a size a page can afford', () => {
    const context = painted()

    withCanvas(() => context)
    readLights(document.createElement('img'))

    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, READ_AT, READ_AT)
  })

  it('answers with nothing rather than throwing when the frame cannot be read', () => {
    withCanvas(() => {
      throw new Error('tainted by a picture from somewhere else')
    })

    expect(readLights(document.createElement('img'))).toEqual([])
  })

  it('answers with nothing where there is no canvas to read with', () => {
    withCanvas(() => null)

    expect(readLights(document.createElement('img'))).toEqual([])
  })
})
