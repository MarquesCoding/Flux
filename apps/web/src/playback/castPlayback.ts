import type { CastState } from './castPlayback.types';

const OWN_NAMES = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

/**
 * Whether a device on the network could fetch anything from here.
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
        onChange('available');
      })
      .then((watch) => {
        stops.push(() => {
          void remote.cancelWatchAvailability(watch);
        });
      })
      .catch(() => {});

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

type PromptOutcome = 'shown' | 'dismissed' | 'refused' | 'unsupported';

/**
 * Asks the browser to show its list of devices.
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

    return named === 'AbortError' || named === 'NotAllowedError' ? 'dismissed' : 'refused';
  }
};

export type { PromptOutcome };

export { isReachableOrigin, absoluteStreamUrl, watchCastState, promptForDevice, OWN_NAMES };
