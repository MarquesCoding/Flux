/**
 * The part of Google's sender library Flux uses, written down.
 *
 * The library ships no types, and describing the whole of it would be a
 * catalogue of things nobody here calls. This is the surface Flux touches and
 * nothing else, which also makes it obvious what a replacement would have to
 * provide.
 */
type CastMediaInfo = {
  contentId: string
  contentType: string
  metadata?: { title?: string }
}

type CastSession = {
  loadMedia: (request: CastLoadRequest) => Promise<void>
  endSession: (stopCasting: boolean) => void
  getCastDevice: () => { friendlyName?: string } | null
}

type CastLoadRequest = {
  media: CastMediaInfo
  currentTime?: number
  autoplay?: boolean
}

/**
 * Where a cast is up to, in the library's own words.
 */
type CastConnectionState = 'NO_DEVICES_AVAILABLE' | 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED'

type CastContext = {
  setOptions: (options: { receiverApplicationId: string; autoJoinPolicy: string }) => void
  requestSession: () => Promise<void>
  getCurrentSession: () => CastSession | null
  getCastState: () => CastConnectionState
  addEventListener: (event: string, listener: () => void) => void
  removeEventListener: (event: string, listener: () => void) => void
}

declare global {
  interface Window {
    /**
     * Called by the library once it has loaded itself, which is the only
     * signal it gives.
     */
    __onGCastApiAvailable?: (isAvailable: boolean) => void
    /**
     * The loading of the library, kept where the loading belongs.
     *
     * Once per page, because the library installs itself globally and objects
     * to being asked twice — and a page is the thing there is one of.
     */
    __fluxCastSender?: Promise<CastContext | null>
    cast?: {
      framework: {
        CastContext: { getInstance: () => CastContext }
        CastContextEventType: { CAST_STATE_CHANGED: string }
      }
    }
    chrome?: {
      cast?: {
        media: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: string
          MediaInfo: new (contentId: string, contentType: string) => CastMediaInfo
          LoadRequest: new (media: CastMediaInfo) => CastLoadRequest
          GenericMediaMetadata: new () => { title?: string }
        }
        AutoJoinPolicy: { ORIGIN_SCOPED: string }
      }
    }
  }
}

/**
 * What loading the library needs of a page: somewhere to put a script tag.
 *
 * Named rather than taking a whole `Document`, so the loading can be proved
 * without conjuring one.
 */
type ScriptHost = {
  createElement: (tag: 'script') => HTMLScriptElement
  head: { append: (node: HTMLScriptElement) => void }
}

/**
 * What the library installs itself onto, and where the loading is remembered.
 */
type CastCarrier = {
  __onGCastApiAvailable?: (isAvailable: boolean) => void
  __fluxCastSender?: Promise<CastContext | null>
  cast?: {
    framework: {
      CastContext: { getInstance: () => CastContext }
      CastContextEventType: { CAST_STATE_CHANGED: string }
    }
  }
  chrome?: {
    cast?: {
      media: {
        DEFAULT_MEDIA_RECEIVER_APP_ID: string
        MediaInfo: new (contentId: string, contentType: string) => CastMediaInfo
        LoadRequest: new (media: CastMediaInfo) => CastLoadRequest
        GenericMediaMetadata: new () => { title?: string }
      }
      AutoJoinPolicy: { ORIGIN_SCOPED: string }
    }
  }
}

export type {
  CastCarrier,
  CastConnectionState,
  CastContext,
  CastLoadRequest,
  CastMediaInfo,
  CastSession,
  ScriptHost,
}
