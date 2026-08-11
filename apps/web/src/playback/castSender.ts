import type { CastCarrier, CastConnectionState, CastContext, ScriptHost } from './castSender.types'

/**
 * Where Google's sender library is fetched from.
 *
 * The one thing in Flux fetched from somebody else at runtime. Fonts are
 * self-hosted, the media engine is bundled, and this is the exception: casting
 * to a Chromecast is a conversation with Google's own protocol, and the
 * library that speaks it is not distributable. Loaded only when somebody asks
 * to cast, so a viewer who never does is never told about it. See ADR-0015.
 */
const SENDER_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'

/**
 * How long to wait for the library before giving up on it.
 *
 * A browser with no network, or one where the request is blocked, must not
 * leave a press with nothing to answer it.
 */
const PATIENCE_MILLISECONDS = 8000

/**
 * The receiver that plays what it is sent.
 *
 * Google's default receiver, which plays a URL and needs no registration.
 * A receiver of our own would let the television carry Flux's own colours and
 * its own subtitle styling; it would also mean an application id, an account
 * and a review, which is a great deal of ceremony for a first version.
 */
const RECEIVER = 'CC1AD845'

/**
 * Loads the sender library and hands back what it provides.
 *
 * Once per page: the library installs itself globally and complains if it is
 * asked twice. Answers with nothing where it could not be had — no network,
 * a browser that blocked it, or a browser without the extension that backs it
 * — because casting is a thing a page offers, not a thing it depends on.
 */
const loadCastSender = (
  host: ScriptHost = document,
  carrier: CastCarrier = window,
): Promise<CastContext | null> => {
  carrier.__fluxCastSender ??= new Promise<CastContext | null>((resolve) => {
    const ready = () => {
      const framework = carrier.cast?.framework
      const chromecast = carrier.chrome?.cast

      if (framework === undefined || chromecast === undefined) {
        resolve(null)

        return
      }

      const context = framework.CastContext.getInstance()

      context.setOptions({
        receiverApplicationId: RECEIVER,
        // Only sessions this page started, so a cast begun in another tab of
        // something else is not quietly taken over.
        autoJoinPolicy: chromecast.AutoJoinPolicy.ORIGIN_SCOPED,
      })

      resolve(context)
    }

    const timer = setTimeout(() => {
      resolve(null)
    }, PATIENCE_MILLISECONDS)

    carrier.__onGCastApiAvailable = (isAvailable) => {
      clearTimeout(timer)

      if (isAvailable) {
        ready()

        return
      }

      resolve(null)
    }

    const script = host.createElement('script')

    script.src = SENDER_URL
    script.async = true
    script.addEventListener('error', () => {
      clearTimeout(timer)
      resolve(null)
    })

    host.head.append(script)
  })

  return carrier.__fluxCastSender
}

/**
 * Whether anything can be cast to, in the library's own words.
 */
const castStateOf = (context: CastContext | null): CastConnectionState =>
  context === null ? 'NO_DEVICES_AVAILABLE' : context.getCastState()

/**
 * Sends a stream to whichever device the viewer chose.
 *
 * The receiver fetches the address itself, so what is sent is a URL and a
 * position rather than any pixels. Answers with whether it was accepted.
 */
const castStream = async (
  context: CastContext,
  { url, title, startSeconds }: { url: string; title: string; startSeconds: number },
): Promise<boolean> => {
  const session = context.getCurrentSession()
  const chromecast = window.chrome?.cast

  if (session === null || chromecast === undefined) {
    return false
  }

  try {
    const media = new chromecast.media.MediaInfo(url, 'application/x-mpegurl')
    const metadata = new chromecast.media.GenericMediaMetadata()

    metadata.title = title
    media.metadata = metadata

    const request = new chromecast.media.LoadRequest(media)

    request.currentTime = startSeconds
    request.autoplay = true

    await session.loadMedia(request)

    return true
  } catch {
    // A receiver that would not take it — a format it cannot play, or an
    // address it cannot reach. Either way the film stays here.
    return false
  }
}

export { loadCastSender, castStateOf, castStream, SENDER_URL, RECEIVER }
