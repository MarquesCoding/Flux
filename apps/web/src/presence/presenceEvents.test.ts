import { describe, expect, it, vi } from 'vitest'
import presenceEventsModule from './presenceEvents'

const { emitPresenceEvent, onPresenceEvent } = presenceEventsModule

describe('presenceEvents', () => {
  it('tells a listener about an event emitted after it subscribed', () => {
    const listener = vi.fn()

    onPresenceEvent(listener)
    emitPresenceEvent({ kind: 'resumed' })

    expect(listener).toHaveBeenCalledWith({ kind: 'resumed' })
  })

  it('tells every listener, not just the first', () => {
    const first = vi.fn()
    const second = vi.fn()

    onPresenceEvent(first)
    onPresenceEvent(second)
    emitPresenceEvent({ kind: 'paused', reason: 'This stream was paused by an admin.' })

    expect(first).toHaveBeenCalled()
    expect(second).toHaveBeenCalled()
  })

  it('stops telling a listener once it unsubscribes', () => {
    const listener = vi.fn()
    const stop = onPresenceEvent(listener)

    stop()
    emitPresenceEvent({ kind: 'stopped', reason: 'This stream was stopped by an admin.' })

    expect(listener).not.toHaveBeenCalled()
  })
})
