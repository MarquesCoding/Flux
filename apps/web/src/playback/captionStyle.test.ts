import { afterEach, describe, expect, it, vi } from 'vitest'
import captionStyleModule from './captionStyle'

const { toCueCss, withOpacity, readCaptionStyle, saveCaptionStyle, DEFAULT_CAPTION_STYLE } =
  captionStyleModule

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('withOpacity', () => {
  it('turns a hex colour into one CSS can fade', () => {
    expect(withOpacity('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
  })

  it('understands the short form', () => {
    expect(withOpacity('#f00', 1)).toBe('rgba(255, 0, 0, 1)')
  })

  it('leaves a colour it cannot read alone rather than drawing it wrong', () => {
    expect(withOpacity('rebeccapurple', 0.5)).toBe('rebeccapurple')
  })
})

describe('toCueCss', () => {
  it('sets the appearance of the text a browser draws', () => {
    const css = toCueCss(DEFAULT_CAPTION_STYLE)

    expect(css).toContain('font-family:')
    expect(css).toContain('font-size: 100%;')
    expect(css).toContain('color: rgba(255, 255, 255, 1);')
  })

  it('carries background opacity separately from background colour', () => {
    const css = toCueCss({ ...DEFAULT_CAPTION_STYLE, backgroundOpacity: 0 })

    expect(css).toContain('background-color: rgba(0, 0, 0, 0);')
  })

  it('draws an outline by default, which reads on a busy scene', () => {
    expect(toCueCss(DEFAULT_CAPTION_STYLE)).toContain('text-shadow: -1px -1px 0 #000')
  })

  it('draws no edge when asked for none', () => {
    expect(toCueCss({ ...DEFAULT_CAPTION_STYLE, edgeStyle: 'none' })).toContain(
      'text-shadow: none;',
    )
  })

  it('scales the text rather than fixing its size', () => {
    expect(toCueCss({ ...DEFAULT_CAPTION_STYLE, fontScale: 200 })).toContain('font-size: 200%;')
  })
})

describe('readCaptionStyle', () => {
  it('answers with the defaults when nothing has been chosen', () => {
    expect(readCaptionStyle()).toEqual(DEFAULT_CAPTION_STYLE)
  })

  it('reads back what was saved', () => {
    saveCaptionStyle({ ...DEFAULT_CAPTION_STYLE, fontScale: 150, edgeStyle: 'shadow' })

    expect(readCaptionStyle()).toMatchObject({ fontScale: 150, edgeStyle: 'shadow' })
  })

  it('falls back to the defaults rather than throwing on a stale setting', () => {
    window.localStorage.setItem('flux.captionStyle', '{"fontScale":"enormous"}')

    expect(readCaptionStyle()).toEqual(DEFAULT_CAPTION_STYLE)
  })

  it('falls back to the defaults when the stored value is not even JSON', () => {
    window.localStorage.setItem('flux.captionStyle', 'not json')

    expect(readCaptionStyle()).toEqual(DEFAULT_CAPTION_STYLE)
  })

  it('refuses a size outside what is readable', () => {
    window.localStorage.setItem('flux.captionStyle', '{"fontScale":5000}')

    expect(readCaptionStyle()).toEqual(DEFAULT_CAPTION_STYLE)
  })
})

describe('saveCaptionStyle', () => {
  it('does not fail when a browser refuses to store anything', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage is full.')
      },
    })

    expect(() => {
      saveCaptionStyle(DEFAULT_CAPTION_STYLE)
    }).not.toThrow()
  })
})
