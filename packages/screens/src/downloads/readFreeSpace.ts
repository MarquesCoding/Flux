/**
 * How much room this device says it has left, in bytes.
 *
 * A browser answers approximately and only where it feels like it: the figure is a quota rather
 * than the disk, it is rounded to resist fingerprinting, and outside a secure context the whole
 * interface is missing however confidently the types say otherwise. So anything unexpected answers
 * nothing rather than guessing — a warning built on an invented number is worse than no warning,
 * because somebody would believe it.
 *
 * @returns The bytes left, or nothing where the device would not say.
 */
const readFreeSpace = async (): Promise<number | null> => {
  try {
    const measured = await navigator.storage.estimate();

    if (measured.quota === undefined) {
      return null;
    }

    return Math.max(0, measured.quota - (measured.usage ?? 0));
  } catch {
    return null;
  }
};

export { readFreeSpace };
