import type { CastCarrier, CastConnectionState, CastContext, ScriptHost } from './castSender.types';

const SENDER_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

const PATIENCE_MILLISECONDS = 8000;

const RECEIVER = 'CC1AD845';

/**
 * Loads the sender library and hands back what it provides.
 */
const loadCastSender = (
  host: ScriptHost = document,
  carrier: CastCarrier = window,
): Promise<CastContext | null> => {
  carrier.__fluxCastSender ??= new Promise<CastContext | null>((resolve) => {
    const ready = () => {
      const framework = carrier.cast?.framework;
      const chromecast = carrier.chrome?.cast;

      if (framework === undefined || chromecast === undefined) {
        resolve(null);

        return;
      }

      const context = framework.CastContext.getInstance();

      context.setOptions({
        receiverApplicationId: RECEIVER,
        autoJoinPolicy: chromecast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      resolve(context);
    };

    const timer = setTimeout(() => {
      resolve(null);
    }, PATIENCE_MILLISECONDS);

    carrier.__onGCastApiAvailable = (isAvailable) => {
      clearTimeout(timer);

      if (isAvailable) {
        ready();

        return;
      }

      resolve(null);
    };

    const script = host.createElement('script');

    script.src = SENDER_URL;
    script.async = true;
    script.addEventListener('error', () => {
      clearTimeout(timer);
      resolve(null);
    });

    host.head.append(script);
  });

  return carrier.__fluxCastSender;
};

/**
 * Whether anything can be cast to, in the library's own words.
 */
const castStateOf = (context: CastContext | null): CastConnectionState =>
  context === null ? 'NO_DEVICES_AVAILABLE' : context.getCastState();

/**
 * Sends a stream to whichever device the viewer chose.
 */
const castStream = async (
  context: CastContext,
  { url, title, startSeconds }: { url: string; title: string; startSeconds: number },
): Promise<boolean> => {
  const session = context.getCurrentSession();
  const chromecast = window.chrome?.cast;

  if (session === null || chromecast === undefined) {
    return false;
  }

  try {
    const media = new chromecast.media.MediaInfo(url, 'application/x-mpegurl');
    const metadata = new chromecast.media.GenericMediaMetadata();

    metadata.title = title;
    media.metadata = metadata;

    const request = new chromecast.media.LoadRequest(media);

    request.currentTime = startSeconds;
    request.autoplay = true;

    await session.loadMedia(request);

    return true;
  } catch {
    return false;
  }
};

export { loadCastSender, castStateOf, castStream, SENDER_URL, RECEIVER };
