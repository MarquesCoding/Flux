import { absoluteStreamUrl } from '@FluxWeb/playback/castPlayback';

type HandOverOptions = {
  element: HTMLVideoElement;
  url: string;
  origin: string;
  release?: () => Promise<void>;
};

/**
 * Points the element at the stream, so a device can fetch it.
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
