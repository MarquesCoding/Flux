import { absoluteStreamUrl } from '@FluxWeb/playback/castPlayback'

type HandOverOptions = {
  element: HTMLVideoElement
  /**
   * Where the stream is, as this page asks for it.
   */
  url: string
  /**
   * Where the page itself is, which is the only address a device can be given.
   */
  origin: string
  /**
   * What to do about the media engine before handing over.
   *
   * A player attached to the element owns its buffers; letting it keep them
   * while the element is pointed somewhere else is how a handover ends with
   * two things playing.
   */
  release?: () => Promise<void>
}

/**
 * Points the element at the stream, so a device can fetch it.
 *
 * Done once a device has actually been chosen rather than while asking for
 * one. A media engine feeding this element re-attaches itself the moment
 * anything else is assigned — proved in the browser: setting a source while
 * Shaka held the element left the element holding a fresh Shaka source a
 * moment later — so the engine is let go of first, and only then is the
 * element told where the stream is.
 *
 * The position is put back, so the film carries on from where the viewer was
 * rather than from the beginning.
 */
const handOverToDevice = async ({
  element,
  url,
  origin,
  release,
}: HandOverOptions): Promise<boolean> => {
  const address = absoluteStreamUrl(url, origin)

  if (address === null) {
    return false
  }

  const at = element.currentTime

  await release?.()

  element.src = address
  element.currentTime = at

  return true
}

export { handOverToDevice }
