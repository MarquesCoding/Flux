import type { CastState } from './castPlayback.types';

/**
 * The names a machine calls itself.
 *
 * A page served from one of these is a page nothing else on the network can
 * follow: a television handed `http://localhost/...` would fetch from its own
 * software, which is not running Flux.
 */
const OWN_NAMES = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

/**
 * Whether a device on the network could fetch anything from here.
 *
 * Asked of the address the viewer is reading the page at, because that is the
 * address a receiver will be given. Somebody browsing their own server by name
 * or by address can cast; somebody browsing it as `localhost` cannot, and is
 * told so rather than left with a picker that leads nowhere.
 */
const isReachableOrigin = (origin: string): boolean => {
  try {
    return !OWN_NAMES.includes(new URL(origin).hostname);
  } catch {
    return false;
  }
};

/**
 * The address of a stream as somewhere else would have to ask for it.
 *
 * Streams are named relatively, which is right for a page fetching its own
 * server and useless to a device that has never heard of it.
 */
const absoluteStreamUrl = (url: string, origin: string): string | null => {
  if (!isReachableOrigin(origin)) {
    return null;
  }

  try {
    return new URL(url, origin).toString();
  } catch {
    return null;
  }
};

/**
 * Watches for somewhere to play, and for the playing having moved there.
 *
 * Two mechanisms because there are two: the standard remote playback interface,
 * which Chrome offers for devices it can reach, and Safari's own, which
 * predates it. A browser has one or the other, never both, and the caller
 * should not have to know which.
 *
 * Says nothing at all where the browser has neither, which is the only way a
 * caller learns there is nothing to offer.
 *
 * Answers with the function that stops watching.
 */
const watchCastState = (
  element: HTMLVideoElement,
  onChange: (state: CastState) => void,
): (() => void) => {
  const stops: (() => void)[] = [];

  if (typeof element.webkitShowPlaybackTargetPicker === 'function') {
    const look = () => {
      onChange(element.webkitCurrentPlaybackTargetIsWireless === true ? 'connected' : 'available');
    };

    // Availability is announced rather than asked for, and the announcement
    // carries whether anything is out there.
    const onAvailability = () => {
      look();
    };

    element.addEventListener('webkitplaybacktargetavailabilitychanged', onAvailability);
    element.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', look);

    stops.push(() => {
      element.removeEventListener('webkitplaybacktargetavailabilitychanged', onAvailability);
      element.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', look);
    });
  }

  const remote = element.remote;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- TypeScript's description of the DOM says every video element has this. Safari's has not, and asking a browser what it can actually do beats believing a type.
  if (remote !== undefined) {
    const said = (state: string) => {
      onChange(
        state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : 'available',
      );
    };

    const onConnecting = () => {
      onChange('connecting');
    };
    const onConnect = () => {
      onChange('connected');
    };
    const onDisconnect = () => {
      onChange('available');
    };

    remote.addEventListener('connecting', onConnecting);
    remote.addEventListener('connect', onConnect);
    remote.addEventListener('disconnect', onDisconnect);

    void remote
      .watchAvailability(() => {
        // Only ever a reveal, never a hiding. A browser feeding a media engine
        // reports nothing available whatever is on the network, because it
        // cannot remote what it is decoding — and casting works anyway, since
        // handing over stops it decoding first. A control that disappears for
        // that reason is a control nobody can find.
        onChange('available');
      })
      .then((watch) => {
        stops.push(() => {
          void remote.cancelWatchAvailability(watch);
        });
      })
      .catch(() => {
        // A browser that has the interface but will not use it here — inside a
        // frame, say. Nothing to offer, and nothing to put right.
      });

    said(remote.state);

    stops.push(() => {
      remote.removeEventListener('connecting', onConnecting);
      remote.removeEventListener('connect', onConnect);
      remote.removeEventListener('disconnect', onDisconnect);
    });
  }

  return () => {
    for (const stop of stops) {
      stop();
    }
  };
};

/**
 * Why a picker did not open.
 *
 * `refused` is the one worth saying out loud: the standard interface is only
 * offered over a secure connection, so a server read over plain HTTP at its
 * address on the network — which is exactly how it has to be read for casting
 * to be any use — is refused by the browser rather than by anything here.
 */
type PromptOutcome = 'shown' | 'dismissed' | 'refused' | 'unsupported';

/**
 * Asks the browser to show its list of devices.
 *
 * The browser's own list rather than one drawn here: no page is allowed to
 * know what is on somebody's network, since a list of it is a fingerprint.
 *
 * Answers with what happened rather than with whether it worked, because the
 * difference between a viewer closing a picker and a browser refusing to open
 * one is the difference between saying nothing and saying what to do.
 */
const promptForDevice = async (element: HTMLVideoElement): Promise<PromptOutcome> => {
  if (typeof element.webkitShowPlaybackTargetPicker === 'function') {
    try {
      element.webkitShowPlaybackTargetPicker();

      return 'shown';
    } catch {
      return 'refused';
    }
  }

  const remote = element.remote;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- As above: the type is a promise the browser has not necessarily kept.
  if (remote === undefined) {
    return 'unsupported';
  }

  try {
    await remote.prompt();

    return 'shown';
  } catch (error) {
    const named = error instanceof Error ? error.name : '';

    // Closing a picker is a decision. Everything else is the browser declining
    // to show one, which is worth passing on.
    return named === 'AbortError' || named === 'NotAllowedError' ? 'dismissed' : 'refused';
  }
};

export type { PromptOutcome };

export { isReachableOrigin, absoluteStreamUrl, watchCastState, promptForDevice, OWN_NAMES };
