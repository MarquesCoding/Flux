import { describe, expect, it } from 'vitest'
import describeDeviceModule from './describeDevice'

const { describeDevice } = describeDeviceModule

describe('describeDevice', () => {
  it('names the browser and the machine it is on', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      ),
    ).toBe('Chrome on macOS')
  })

  it('believes the most specific claim, since every browser claims to be several', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0',
      ),
    ).toBe('Edge on Windows')
  })

  it('tells a phone from a desktop', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iPhone')
  })

  it('names the machine alone where the browser is not one it knows', () => {
    expect(describeDevice('SomeTelevision/2.0 (Linux)')).toBe('Linux')
  })

  it('admits it does not know rather than inventing a name', () => {
    expect(describeDevice('')).toBe('Unknown device')
    expect(describeDevice(null)).toBe('Unknown device')
    expect(describeDevice(undefined)).toBe('Unknown device')
  })

  it('keeps a manageable amount of whatever it was told instead', () => {
    const said = describeDevice('x'.repeat(200))

    expect(said.length).toBeLessThanOrEqual(40)
  })
})
