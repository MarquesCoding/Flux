const STEP_MILLISECONDS = 40;

/**
 * Takes a clip's sound down to nothing before it is put away, so one leaving the screen falls quiet
 * over the same moment its picture fades rather than cutting off mid-sentence. Answers immediately
 * for a clip that was silent anyway, which is most of them.
 *
 * @param element - The clip being taken away.
 * @param milliseconds - How long it has to fall silent in.
 * @returns When it has gone quiet and stopped.
 */
const fadeAudioOut = async (element: HTMLVideoElement, milliseconds: number): Promise<void> => {
  const from = element.volume;

  if (element.muted || element.paused || from === 0 || milliseconds <= 0) {
    element.pause();

    return;
  }

  await new Promise<void>((quiet) => {
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += STEP_MILLISECONDS;

      const gone = elapsed / milliseconds;

      if (gone >= 1) {
        clearInterval(timer);
        element.volume = 0;
        element.pause();
        quiet();

        return;
      }

      element.volume = from * (1 - gone);
    }, STEP_MILLISECONDS);
  });
};

export { fadeAudioOut, STEP_MILLISECONDS };
