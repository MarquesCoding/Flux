import { absoluteStreamUrl } from '@FluxScreens/playback/castPlayback';

type HandOverOptions = {
  element: HTMLVideoElement;
  url: string;
  origin: string;
  release?: () => Promise<void>;
};

/**
 * Hands playback to another device by pointing it at the stream directly, so the device fetches from
 * this server rather than having the picture relayed through the browser.
 *
 * @param options - The stream to hand over, where to start, and the device to hand it to.
 */
const handOverToDevice = async ({
  element,
  url,
  origin,
  release,
}: HandOverOptions): Promise<boolean> => {
  const address = absoluteStreamUrl(url, origin);

  if (address === null) {
    return false;
  }

  const at = element.currentTime;

  await release?.();

  element.src = address;
  element.currentTime = at;

  return true;
};

export { handOverToDevice };
