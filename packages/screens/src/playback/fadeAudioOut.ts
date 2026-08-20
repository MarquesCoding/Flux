import { rampVolume } from '@FluxScreens/playback/rampVolume';

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
  if (element.muted || element.paused || element.volume === 0 || milliseconds <= 0) {
    element.pause();

    return;
  }

  await rampVolume(element, 0, milliseconds);
  element.pause();
};

export { fadeAudioOut };
