const NO_BOOST = 1;

type MaybeAudio = { AudioContext?: typeof AudioContext };

const amplifiers = new WeakMap<HTMLMediaElement, GainNode>();

/**
 * The amplifier standing between one element and the speakers, made the first time it is asked for
 * and kept for as long as the element lives.
 *
 * A browser lets an element be routed into Web Audio once and never again, so the amplifier is
 * remembered against the element rather than built afresh each time the loudness changes. Built only
 * when somebody actually asks to go past the maximum, too: routing cannot be undone, and on some
 * browsers it takes the sound away from AirPlay with it. Whoever leaves this alone keeps an element
 * nothing has been done to.
 *
 * @param element - The element being played.
 * @returns Its amplifier, or nothing where this browser has no Web Audio to route into.
 */
const amplifierFor = (element: HTMLMediaElement): GainNode | null => {
  const found = amplifiers.get(element);

  if (found !== undefined) {
    return found;
  }

  const source: MaybeAudio = window;

  if (source.AudioContext === undefined) {
    return null;
  }

  try {
    const engine = new source.AudioContext();
    const loudness = engine.createGain();

    engine.createMediaElementSource(element).connect(loudness);
    loudness.connect(engine.destination);
    void engine.resume();

    amplifiers.set(element, loudness);

    return loudness;
  } catch {
    return null;
  }
};

/**
 * Makes something louder than its own loudest, for a film mastered so quietly that full volume is
 * still not enough to hear it over a room.
 *
 * Below the maximum this does nothing at all rather than quietly building the machinery to do
 * nothing with — the element's own volume already covers everything up to its loudest, and what is
 * not built cannot take AirPlay down with it.
 *
 * @param element - The element being played.
 * @param boost - How much louder than its own maximum, where one is untouched.
 * @returns Whether the loudness asked for is the loudness now playing.
 */
const applyVolumeBoost = (element: HTMLMediaElement, boost: number): boolean => {
  const wanted = Math.max(NO_BOOST, boost);

  if (wanted === NO_BOOST && !amplifiers.has(element)) {
    return true;
  }

  const loudness = amplifierFor(element);

  if (loudness === null) {
    return false;
  }

  loudness.gain.value = wanted;

  return true;
};

export { applyVolumeBoost, NO_BOOST };
