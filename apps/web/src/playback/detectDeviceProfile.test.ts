import { afterEach, describe, expect, it, vi } from 'vitest'
import DeviceProfileModule from '@FluxContracts/schemas/DeviceProfile'
import detectDeviceProfileModule from './detectDeviceProfile'

const { DeviceProfileSchema } = DeviceProfileModule
const { detectDeviceProfile } = detectDeviceProfileModule

const supporting =
  (...supported: string[]) =>
  (mimeType: string) =>
    supported.some((fragment) => mimeType.includes(fragment))

const build = (
  isTypeSupported: (mimeType: string) => boolean,
  overrides: Partial<Parameters<typeof detectDeviceProfile>[0]> = {},
) =>
  detectDeviceProfile({
    isTypeSupported,
    supportsHdr: false,
    screenWidth: 1920,
    screenHeight: 1080,
    name: 'Browser',
    ...overrides,
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detectDeviceProfile', () => {
  it('produces a profile the server contract accepts', () => {
    const profile = build(supporting('avc1', 'mp4a'))

    expect(DeviceProfileSchema.safeParse(profile).success).toBe(true)
  })

  it('reports the codecs the browser actually supports', () => {
    const profile = build(supporting('avc1', 'hvc1', 'mp4a', 'ec-3'))

    expect(profile.directPlayProfiles[0]?.videoCodecs).toEqual(['h264', 'hevc'])
    expect(profile.directPlayProfiles[0]?.audioCodecs).toEqual(['aac', 'eac3'])
  })

  it('does not claim a codec the browser rejects', () => {
    const profile = build(supporting('avc1', 'mp4a'))

    expect(profile.directPlayProfiles[0]?.videoCodecs).not.toContain('hevc')
    expect(profile.directPlayProfiles[0]?.audioCodecs).not.toContain('eac3')
  })

  it('probes concrete codec strings rather than container families', () => {
    const seen: string[] = []

    build((mimeType) => {
      seen.push(mimeType)

      return false
    })

    expect(seen.every((mimeType) => mimeType.includes('codecs='))).toBe(true)
  })

  it('falls back to h264 and aac when the browser answers nothing', () => {
    const profile = build(() => false)

    expect(profile.directPlayProfiles[0]?.videoCodecs).toEqual(['h264'])
    expect(profile.directPlayProfiles[0]?.audioCodecs).toEqual(['aac'])
  })

  it('claims only SDR by default', () => {
    expect(build(supporting('avc1')).supportedVideoRanges).toEqual(['SDR'])
  })

  it('claims HDR when the display reports a high dynamic range', () => {
    const profile = build(supporting('avc1', 'hvc1'), { supportsHdr: true })

    expect(profile.supportedVideoRanges).toContain('HDR10')
    expect(profile.supportedVideoRanges).toContain('HLG')
  })

  it('uses the real screen size as the resolution ceiling', () => {
    const profile = build(supporting('avc1'), { screenWidth: 3840, screenHeight: 2160 })

    expect(profile.maxWidth).toBe(3840)
    expect(profile.maxHeight).toBe(2160)
  })

  it('never reports a ceiling below a sensible floor', () => {
    const profile = build(supporting('avc1'), { screenWidth: 100, screenHeight: 80 })

    expect(profile.maxWidth).toBe(640)
    expect(profile.maxHeight).toBe(480)
  })

  it('always offers a transcoding target the server can produce', () => {
    const profile = build(() => false)

    expect(profile.transcodingProfiles[0]).toMatchObject({
      container: 'ts',
      videoCodec: 'h264',
      protocol: 'hls',
    })
  })

  it('claims webvtt subtitles only', () => {
    expect(build(supporting('avc1')).supportedSubtitleFormats).toEqual(['webvtt'])
  })

  it('carries the client name through', () => {
    expect(build(supporting('avc1'), { name: 'Living room' }).name).toBe('Living room')
  })

  it('reports no HDR rather than failing in a browser without media queries', () => {
    vi.stubGlobal('matchMedia', undefined)

    expect(() => detectDeviceProfileModule.detectFromBrowser()).not.toThrow()
    expect(detectDeviceProfileModule.detectFromBrowser().supportedVideoRanges).toEqual(['SDR'])
  })
})
