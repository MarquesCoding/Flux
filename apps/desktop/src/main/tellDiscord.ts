import { createConnection } from 'node:net';
import type { Socket } from 'node:net';
import {
  aDiscordFrame,
  FRAME,
  HANDSHAKE,
  readDiscordFrames,
} from '@FluxDesktop/main/aDiscordFrame';
import { aDiscordActivity } from '@FluxDesktop/main/aDiscordActivity';
import { whereDiscordListens } from '@FluxDesktop/main/whereDiscordListens';
import type { WhatIsPlaying } from '@FluxDesktop/main/aDiscordActivity';

const CLIENT_ID = '1539800715281563738';

const VERSION = 1;

type Presence = {
  about: (playing: WhatIsPlaying | null) => void;
  close: () => void;
};

/**
 * Says what somebody is watching in their Discord status, where Discord is running.
 *
 * It is a socket the Discord client opens on the same machine — a named pipe on Windows, a Unix
 * socket everywhere else — which is why this lives out here and not in the page. A browser cannot
 * reach either, and no amount of the window being a browser changes that.
 *
 * Nothing here is required to work. Discord is not running for most people most of the time, the
 * socket may be any of ten, and it goes away when Discord quits. Every failure is quiet and every
 * one is recoverable: the connection is dropped, and the next thing somebody plays tries again from
 * the beginning. A media player that complained about a chat application would be a worse media
 * player.
 *
 * @param temporary - Where this machine keeps this user's temporary files, which is where Discord
 *   listens on a Mac. Passed in rather than read from the environment, which does not always carry
 *   it.
 * @param version - Which Flux this is, for the picture to say when somebody rests on it.
 * @returns How to say what is playing, and how to stop.
 */
const tellDiscord = (temporary: string, version: string): Presence => {
  let socket: Socket | null = null;
  let ready = false;
  let waiting: WhatIsPlaying | null = null;
  let arrived: Buffer = Buffer.alloc(0);

  const send = (opcode: number, payload: object): void => {
    socket?.write(aDiscordFrame(opcode, JSON.stringify(payload)));
  };

  const setActivity = (playing: WhatIsPlaying | null): void => {
    send(FRAME, {
      cmd: 'SET_ACTIVITY',
      nonce: `${Date.now().toString()}`,
      args: { pid: process.pid, activity: aDiscordActivity(playing, version) },
    });
  };

  const forget = (): void => {
    socket?.destroy();
    socket = null;
    ready = false;
    arrived = Buffer.alloc(0);
  };

  const heard = (chunk: Buffer): void => {
    arrived = Buffer.concat([arrived, chunk]);

    const read = readDiscordFrames(arrived);
    arrived = read.rest;

    for (const frame of read.frames) {
      if (frame.opcode === HANDSHAKE || ready) {
        continue;
      }

      ready = true;

      if (waiting !== null) {
        setActivity(waiting);
      }
    }
  };

  const connect = (paths: readonly string[]): void => {
    const [first, ...rest] = paths;

    if (first === undefined) {
      return;
    }

    const trying = createConnection(first);

    trying.on('error', () => {
      trying.destroy();

      if (socket === trying) {
        forget();

        return;
      }

      connect(rest);
    });

    trying.on('connect', () => {
      socket = trying;
      send(HANDSHAKE, { v: VERSION, client_id: CLIENT_ID });
    });

    trying.on('data', heard);
    trying.on('close', forget);
  };

  return {
    about: (playing) => {
      waiting = playing;

      if (socket === null) {
        if (playing !== null) {
          connect(whereDiscordListens(process.platform, process.env, temporary));
        }

        return;
      }

      if (ready) {
        setActivity(playing);
      }
    },
    close: () => {
      if (ready) {
        setActivity(null);
      }

      forget();
    },
  };
};

export type { Presence };

export { tellDiscord };
