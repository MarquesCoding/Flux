/**
 * Keeps a video's subtitles clear of whatever is drawn over its foot.
 *
 * A browser lifts cues above its own controls and knows nothing about ours, so
 * a bar laid over the bottom of a film covers the line somebody is reading.
 * The cues are moved instead, which is the only thing that works: `::cue`
 * cannot be positioned, and the cue box lives in a shadow tree the page cannot
 * reach any other way.
 *
 * Cues arrive after the track does, so setting a line once lifts nothing.
 * Every moment a cue changes is a moment there are cues to move, which makes
 * that the one event worth listening to.
 *
 * Answers with the function that stops watching.
 */
const liftCues = (
  element: HTMLVideoElement,
  lineAt: () => number,
): { stop: () => void; apply: () => void } => {
  const lift = () => {
    const line = lineAt()

    for (const track of Array.from(element.textTracks)) {
      for (const cue of Array.from(track.cues ?? [])) {
        // A cue from a format that does not carry a position is a cue there is
        // nothing to move.
        if ('line' in cue && 'snapToLines' in cue) {
          cue.snapToLines = false
          cue.line = line
        }
      }
    }
  }

  const watch = () => {
    lift()

    for (const track of Array.from(element.textTracks)) {
      track.addEventListener('cuechange', lift)
    }
  }

  watch()
  element.textTracks.addEventListener('addtrack', watch)

  return {
    // Also callable from outside, because the line can change while a cue is
    // already on screen: the bar fading is exactly that, and a cue that only
    // moves when the next one arrives leaves the current one where it was.
    apply: lift,
    stop: () => {
      element.textTracks.removeEventListener('addtrack', watch)

      for (const track of Array.from(element.textTracks)) {
        track.removeEventListener('cuechange', lift)
      }
    },
  }
}

/**
 * How far down the picture a cue sits while nothing is over it.
 */
const CUE_LINE_CLEAR = 92

/**
 * How far down it sits while the controls are up.
 *
 * High enough to clear a bar the depth of the player's, which is a scrub line
 * and a row of buttons.
 */
const CUE_LINE_ABOVE_CONTROLS = 80

export default { liftCues, CUE_LINE_CLEAR, CUE_LINE_ABOVE_CONTROLS }
