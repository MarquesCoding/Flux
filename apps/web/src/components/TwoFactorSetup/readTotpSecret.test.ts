import { describe, expect, it } from 'vitest'
import { readTotpSecret, formatTotpSecret } from './readTotpSecret'

describe('readTotpSecret', () => {
  it('extracts the secret from an otpauth uri', () => {
    expect(
      readTotpSecret('otpauth://totp/Flux:admin@flux.test?secret=JBSWY3DPEHPK3PXP&issuer=Flux'),
    ).toBe('JBSWY3DPEHPK3PXP')
  })

  it('returns nothing when the uri has no secret', () => {
    expect(readTotpSecret('otpauth://totp/Flux:admin@flux.test?issuer=Flux')).toBe('')
  })

  it('returns nothing for a value that is not a uri', () => {
    expect(readTotpSecret('not a uri')).toBe('')
  })
})

describe('formatTotpSecret', () => {
  it('groups the secret into blocks of four', () => {
    expect(formatTotpSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP')
  })

  it('leaves a short trailing block intact', () => {
    expect(formatTotpSecret('ABCDEF')).toBe('ABCD EF')
  })

  it('returns nothing for an empty secret', () => {
    expect(formatTotpSecret('')).toBe('')
  })
})
