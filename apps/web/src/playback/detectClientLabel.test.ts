import { describe, expect, it } from 'vitest'
import detectClientLabelModule from './detectClientLabel'

const { detectClientLabel } = detectClientLabelModule

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

describe('detectClientLabel', () => {
  it('names a Chromium-based browser on macOS, rather than assuming it is Chrome', () => {
    expect(detectClientLabel(CHROME_MAC)).toBe('Chromium on macOS')
  })

  it('tells Safari apart from Chromium, even though both carry "Safari"', () => {
    expect(detectClientLabel(SAFARI_MAC)).toBe('Safari on macOS')
  })

  it('names Firefox on Linux', () => {
    expect(detectClientLabel(FIREFOX_LINUX)).toBe('Firefox on Linux')
  })

  it('tells Edge apart from Chromium, even though Edge carries "Chrome" too', () => {
    expect(detectClientLabel(EDGE_WINDOWS)).toBe('Edge on Windows')
  })

  it('names Safari on iOS', () => {
    expect(detectClientLabel(SAFARI_IOS)).toBe('Safari on iOS')
  })

  it('names a Chromium-based browser on Android', () => {
    expect(detectClientLabel(CHROME_ANDROID)).toBe('Chromium on Android')
  })

  it('falls back to a generic name for a user agent it does not recognise', () => {
    expect(detectClientLabel('SomeRobot/1.0')).toBe('Browser')
  })
})
