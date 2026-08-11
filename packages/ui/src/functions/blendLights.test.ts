import { describe, expect, it } from 'vitest'
import { blendLights } from './blendLights'

describe('blendLights', () => {
  it('moves each light part of the way towards where it is going', () => {
    const held = [{ color: 'rgb(0 0 0)' }]
    const wanted = [{ color: 'rgb(100 200 40)' }]

    expect(blendLights(held, wanted, 0.5)).toEqual([{ color: 'rgb(50 100 20)' }])
  })

  it('arrives when told to go the whole way', () => {
    const held = [{ color: 'rgb(10 20 30)' }]
    const wanted = [{ color: 'rgb(200 100 50)' }]

    expect(blendLights(held, wanted, 1)).toEqual([{ color: 'rgb(200 100 50)' }])
  })

  it('stays where it is when told to move none of the way', () => {
    const held = [{ color: 'rgb(10 20 30)' }]
    const wanted = [{ color: 'rgb(200 100 50)' }]

    expect(blendLights(held, wanted, 0)).toEqual([{ color: 'rgb(10 20 30)' }])
  })

  it('keeps where each light comes from', () => {
    const held = [{ color: 'rgb(0 0 0)', at: '10% 10%' }]
    const wanted = [{ color: 'rgb(100 100 100)', at: '90% 90%' }]

    expect(blendLights(held, wanted, 0.5)[0]?.at).toBe('90% 90%')
  })

  it('takes a light it has no previous colour for as it is', () => {
    // Nothing to move from, so the answer is where it was going. Easing up
    // from a colour that was never there would be a wash sliding in from
    // nowhere.
    expect(blendLights([], [{ color: 'rgb(1 2 3)' }], 0.2)).toEqual([{ color: 'rgb(1 2 3)' }])
  })

  it('takes a colour it cannot read as it is', () => {
    const held = [{ color: 'rgb(0 0 0)' }]
    const wanted = [{ color: 'oklch(0.5 0.1 200)' }]

    expect(blendLights(held, wanted, 0.5)).toEqual([{ color: 'oklch(0.5 0.1 200)' }])
  })

  it('answers with as many lights as it was asked for', () => {
    const held = [{ color: 'rgb(0 0 0)' }, { color: 'rgb(0 0 0)' }]
    const wanted = [{ color: 'rgb(10 10 10)' }]

    expect(blendLights(held, wanted, 1)).toHaveLength(1)
  })
})
