import type { CastCarrier, CastConnectionState, CastContext, ScriptHost } from './castSender.types';

const SENDER_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

const PATIENCE_MILLISECONDS = 8000;

const RECEIVER = 'CC1AD845';

/**
 * Loads the casting library on demand and hands back what it provides. Loaded only when somebody
 * asks to cast, since most sessions never do and it is not a small thing to fetch.
 *
 * @param host - Where the script tag is added, taken as an argument so tests need no document.
 * @param carrier - What the loaded library attaches itself to, and where the promise is cached so a
 *   second request does not fetch it again.
 * @returns What the library provides, or null where it could not be loaded.
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
 * Reads whether there is anything to cast to, in the casting library's own vocabulary, so the button
 * knows whether to appear at all.
 *
 * @param context - The cast context.
 * @returns The state, as Valence describes it.
 */
const castStateOf = (context: CastContext | null): CastConnectionState =>
  context === null ? 'NO_DEVICES_AVAILABLE' : context.getCastState();

/**
 * Sends a stream to whichever device the viewer chose, along with what it is and where to start, so
 * the device shows a title rather than an address.
 *
 * @param context - The cast context.
 * @param request - The stream, what it is called, and where to start.
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
