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
 * stop being a media engine first: the element is pointed at the stream
 * directly, the position is put back so the film carries on from where it was,
 * and the engine is let go of afterwards.
 *
 * Answers with whether a picker was shown. Nothing is torn down when there was
 * no address to give, so a viewer who cannot cast is left watching what they
 * were watching.
 */
const handOverToDevice = ({ element, url, origin, release }: HandOverOptions): Promise<boolean> => {
  const address = absoluteStreamUrl(url, origin)

  if (address === null) {
    return Promise.resolve(false)
  }

  const at = element.currentTime

  // Nothing is awaited before the picker is asked for. A browser only opens
  // one while the press that asked for it still counts as a press, and waiting
  // on a media engine to tear itself down — however briefly — spends that.
  // Pointing the element at an address is what detaches the engine's buffers
  // as far as the browser is concerned, and it takes effect at once.
  element.src = address
  element.currentTime = at

  const shown = promptForDevice(element)

  void release?.().then(() => {
    // An engine tearing down after the fact can clear what it was attached to.
    // Whatever it does, this element is pointed at the stream.
    if (element.src !== address) {
      element.src = address
      element.currentTime = at
    }
  })

  return shown
}

export default { handOverToDevice }
