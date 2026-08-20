const STEP_MILLISECONDS = 40;

/**
 * Moves a clip's volume to where it should be over a moment rather than in one step, so sound
 * arriving or leaving is something that happens rather than something that catches somebody out.
 *
 * @param element - The clip being turned up or down.
 * @param to - The volume to arrive at.
 * @param milliseconds - How long it has to get there.
 * @returns When it has arrived.
 */
const rampVolume = async (
  element: HTMLVideoElement,
  to: number,
  milliseconds: number,
): Promise<void> => {
  const from = element.volume;

  if (from === to || milliseconds <= 0) {
    element.volume = to;

    return;
  }

  await new Promise<void>((arrived) => {
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += STEP_MILLISECONDS;

      const gone = elapsed / milliseconds;

      if (gone >= 1) {
        clearInterval(timer);
        element.volume = to;
        arrived();

        return;
      }

      element.volume = from + (to - from) * gone;
    }, STEP_MILLISECONDS);
  });
};

export { rampVolume, STEP_MILLISECONDS };
