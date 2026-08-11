import { describe, expect, it } from 'vitest'
import createWorkLockModule from './createWorkLock'

const { createWorkLock } = createWorkLockModule

/**
 * A piece of work that does not finish until it is told to.
 */
const deferred = () => {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

describe('createWorkLock', () => {
  it('runs work for one key one piece at a time', async () => {
    const lock = createWorkLock()
    const order: string[] = []
    const first = deferred()

    const a = lock.run('library-1', async () => {
      order.push('a started')
      await first.promise
      order.push('a finished')
    })

    const b = lock.run('library-1', () => {
      order.push('b started')

      return Promise.resolve()
    })

    expect(order).toEqual(['a started'])

    first.release()
    await Promise.all([a, b])

    expect(order).toEqual(['a started', 'a finished', 'b started'])
  })

  it('lets different keys run at the same time', async () => {
    const lock = createWorkLock()
    const order: string[] = []
    const first = deferred()

    const a = lock.run('library-1', async () => {
      order.push('a started')
      await first.promise
    })

    const b = lock.run('library-2', () => {
      order.push('b started')

      return Promise.resolve()
    })

    await b

    expect(order).toEqual(['a started', 'b started'])

    first.release()
    await a
  })

  it('reports what the work returned', async () => {
    const lock = createWorkLock()

    await expect(lock.run('library-1', () => Promise.resolve(42))).resolves.toBe(42)
  })

  it('reports a failure to the caller that asked for it', async () => {
    const lock = createWorkLock()

    await expect(lock.run('library-1', () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    )
  })

  it('does not wedge a key behind work that failed', async () => {
    const lock = createWorkLock()

    await expect(lock.run('library-1', () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    )

    await expect(lock.run('library-1', () => Promise.resolve('ran anyway'))).resolves.toBe(
      'ran anyway',
    )
  })

  it('forgets a key once its work is done, rather than growing forever', async () => {
    const lock = createWorkLock()

    await lock.run('library-1', () => Promise.resolve())

    // The key is released a tick after the work settles, so this waits for
    // the queue to drain rather than assuming it already has.
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Nothing is left holding the key: a piece queued now starts outright
    // rather than waiting behind a chain that already finished.
    let started = false

    const next = lock.run('library-1', () => {
      started = true

      return Promise.resolve()
    })

    expect(started).toBe(true)

    await next
  })
})
