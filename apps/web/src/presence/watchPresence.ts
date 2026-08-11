import { z } from 'zod'
import detectClientLabelModule from '@FluxWeb/playback/detectClientLabel'
import clientIdentityModule from './clientIdentity'
import presenceEventsModule from './presenceEvents'

const { detectFromNavigator } = detectClientLabelModule
const { readClientId } = clientIdentityModule
const { emitPresenceEvent } = presenceEventsModule

const PresenceEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stopped'), reason: z.string() }),
  z.object({ kind: z.literal('paused'), reason: z.string() }),
  z.object({ kind: z.literal('resumed') }),
])

/**
 * Opens this tab's own presence connection.
 *
 * Meant to be opened once, at the app root, for as long as somebody is
 * signed in — not per player. The connection is what makes this tab "present"
 * in the admin's Active Sessions list at all, whether or not anything is
 * playing, and it is also the channel an admin's stop, pause and resume
 * arrive on.
 *
 * Returns the function that closes it.
 */
const watchPresence = (): (() => void) => {
  const params = new URLSearchParams({
    clientId: readClientId(),
    deviceLabel: detectFromNavigator(),
  })

  const source = new EventSource(`/api/presence/stream?${params.toString()}`, {
    withCredentials: true,
  })

  source.onmessage = (event: MessageEvent<string>) => {
    const parsed = PresenceEventSchema.safeParse(JSON.parse(event.data))

    if (parsed.success) {
      emitPresenceEvent(parsed.data)
    }
  }

  return () => {
    source.close()
  }
}

export default { watchPresence }
