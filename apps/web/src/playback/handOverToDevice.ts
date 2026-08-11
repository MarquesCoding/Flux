import castPlaybackModule from '@FluxWeb/playback/castPlayback'

const { absoluteStreamUrl, promptForDevice } = castPlaybackModule

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
 * Gives what is playing to a device on the network.
 *
 * A browser cannot remote what it is decoding itself. Both mechanisms hand the
 * receiver an address and let it fetch the stream, which means the page has to
 * stop being a media engine first: the engine is released, the element is
 * pointed at the stream directly, and the position is put back so the film
 * carries on from where it was rather than from the beginning.
 *
 * Answers with whether a picker was shown. Nothing is torn down when it was
 * not, so a viewer who cannot cast is left watching what they were watching.
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

  const shown = await promptForDevice(element)

  if (!shown) {
    return false
  }

  return true
}

export default { handOverToDevice }
