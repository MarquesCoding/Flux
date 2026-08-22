import { net } from 'electron';

const PORT = 8420;

const WHERE_ONE_USUALLY_IS = [
  `http://localhost:${PORT.toString()}`,
  `http://127.0.0.1:${PORT.toString()}`,
];

const GIVE_EACH_MILLISECONDS = 1500;

const LOOK_AGAIN_EVERY_MS = 2000;

const STOP_LOOKING_AFTER_MS = 60_000;

/**
 * Asks an address whether there is a Flux behind it.
 *
 * Health is the one thing a server answers to nobody in particular, so it can be asked before there
 * is a session or any reason to believe the address is right at all. Asked from this process rather
 * than from the page, because the page is served from a scheme of its own and a browser would refuse
 * the request for being somebody else's origin long before any server saw it.
 *
 * @param address - Where a Flux might be.
 * @returns Whether one answered.
 */
const isAFlux = async (address: string): Promise<boolean> => {
  try {
    const answered = await net.fetch(`${address}/api/health`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(GIVE_EACH_MILLISECONDS),
    });

    return answered.ok;
  } catch {
    return false;
  }
};

/**
 * Looks for a Flux on this machine, so that nobody has to be asked where their own server is.
 *
 * The overwhelmingly common case is a server running on the same machine as the client, on the port
 * it uses unless told otherwise. Asking somebody to type that is asking them to tell the application
 * something it could have found out in a few milliseconds, and the screen that asks is the first
 * thing they see.
 *
 * Only this machine is looked at. Sweeping a network for open ports is a different kind of act
 * altogether — it is what a scanner does, it takes far longer than anybody will wait, and on a
 * shared network it means knocking on machines that are not ours to knock on. Somebody whose Flux is
 * elsewhere is asked, which is the one case worth asking about.
 *
 * @param reach - How to ask whether a Flux is there, which a test replaces.
 * @returns The address of the one it found, or nothing.
 */
const lookForAFlux = async (
  reach: (address: string) => Promise<boolean> = isAFlux,
): Promise<string | null> => {
  for (const address of WHERE_ONE_USUALLY_IS) {
    if (await reach(address)) {
      return address;
    }
  }

  return null;
};

/**
 * Keeps looking for a while, for a server that has not finished starting.
 *
 * A client and a server started together race, and the client is quicker: it is one window and the
 * other is a database, a migration and a scan. Looking once would mean the person who starts both at
 * once is asked where their server is, seconds before it announces itself. So this keeps looking
 * quietly while they read the screen, and answers it for them if one turns up.
 *
 * @param found - Told the address, if one turns up.
 * @param reach - How to ask whether a Flux is there, which a test replaces.
 * @returns How to stop looking.
 */
const keepLookingForAFlux = (
  found: (address: string) => void,
  reach: (address: string) => Promise<boolean> = isAFlux,
): (() => void) => {
  let stopped = false;

  const timer = setInterval(() => {
    void lookForAFlux(reach).then((address) => {
      if (address !== null && !stopped) {
        stop();
        found(address);
      }
    });
  }, LOOK_AGAIN_EVERY_MS);

  const giveUp = setTimeout(() => {
    stop();
  }, STOP_LOOKING_AFTER_MS);

  function stop(): void {
    stopped = true;

    clearInterval(timer);
    clearTimeout(giveUp);
  }

  return stop;
};

export {
  GIVE_EACH_MILLISECONDS,
  LOOK_AGAIN_EVERY_MS,
  STOP_LOOKING_AFTER_MS,
  WHERE_ONE_USUALLY_IS,
  isAFlux,
  keepLookingForAFlux,
  lookForAFlux,
};
