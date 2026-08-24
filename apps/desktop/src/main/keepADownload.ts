import { once } from 'node:events';
import { createWriteStream } from 'node:fs';

const EVERY = 500;

type AskingTheServer = (where: string, how?: RequestInit) => Promise<Response>;

type Progress = {
  bytes: number;
  ofBytes: number | null;
  bytesPerSecond: number;
};

type Outcome = {
  bytes: number;
  isComplete: boolean;
  failure: string | null;
};

type Fetching = {
  stop: () => void;
  finished: Promise<Outcome>;
};

type WhatToFetch = {
  from: string;
  onto: string;
  already: number;
  fetching: AskingTheServer;
  report: (progress: Progress) => void;
};

/**
 * How big the whole thing is, according to an answer that may only be part of it.
 *
 * Two headers say different things and only one of them is the answer. A partial answer states the
 * length of the whole file after the slash in its content range, while its content length is the
 * length of this piece alone — so the first is used as it stands and the second has to have what is
 * already on the disk added back to it. Reading a piece as the whole makes a resumed transfer look
 * like a much smaller file that finishes at once, at whatever fraction it stopped at.
 *
 * @param answer - What the server said.
 * @param already - How much is on the disk, which this answer does not include.
 * @param startingOver - Whether the server ignored the range and sent everything again, in which
 * case what was on the disk is about to be overwritten rather than added to.
 * @returns The length of the whole file, or nothing where the server did not say.
 */
const howBig = (answer: Response, already: number, startingOver: boolean): number | null => {
  const range = answer.headers.get('content-range');
  const whole = range === null ? undefined : /\/(?<total>\d+)\s*$/u.exec(range)?.groups?.['total'];

  if (whole !== undefined) {
    return Number(whole);
  }

  const length = answer.headers.get('content-length');

  return length === null ? null : (startingOver ? 0 : already) + Number(length);
};

/**
 * Fetches a prepared file to the disk, and can be stopped and picked up again later.
 *
 * The transfer is made here rather than handed to the browser's own downloader, which is the whole
 * point of the exercise: a file the application fetched is a file the application knows the name of,
 * can check is still there, and can play. One the browser fetched is somewhere in a folder, under
 * whatever name avoided a collision, and is gone as far as Valence is concerned.
 *
 * Resuming asks for the rest with a range and appends. A server that ignores the range and sends the
 * whole file again says so by answering with all of it rather than part of it, and the answer is to
 * start the file again rather than append a second copy to the end of the first — which would
 * produce a file of exactly the right length made of the wrong bytes.
 *
 * Progress is reported on a timer rather than per chunk. A chunk is a few kilobytes and a film is
 * millions of them, and telling the window about each one costs more than the transfer.
 *
 * Stopping is not failing. What is on the disk stays there, and the caller is told how much of it
 * there is, because that is where the next attempt begins. The loop watches for it itself rather
 * than waiting to be interrupted: whether aborting the request tears down a body already being read
 * is up to whoever implemented the fetch, and a transfer that carried on to the end of a four
 * gigabyte film after somebody pressed pause would be a poor way to find that out.
 *
 * @param asked - Where to fetch from, where to put it, how much is already there, and who to tell.
 * @returns A way to stop it, and how it went.
 */
const keepADownload = (asked: WhatToFetch): Fetching => {
  const stopper = new AbortController();

  const run = async (): Promise<Outcome> => {
    let bytes = asked.already;

    const answer = await asked.fetching(asked.from, {
      signal: stopper.signal,
      ...(asked.already > 0 ? { headers: { range: `bytes=${asked.already}-` } } : {}),
    });

    if (!answer.ok) {
      return { bytes, isComplete: false, failure: `The server answered ${answer.status}.` };
    }

    if (answer.body === null) {
      return { bytes, isComplete: false, failure: 'The server sent no file.' };
    }

    const startingOver = asked.already > 0 && answer.status !== 206;

    if (startingOver) {
      bytes = 0;
    }

    const whole = howBig(answer, asked.already, startingOver);
    const onto = createWriteStream(asked.onto, { flags: bytes > 0 ? 'a' : 'w' });
    const reader = answer.body.getReader();

    let toldAt = Date.now();
    let toldAbout = bytes;

    const tell = (): void => {
      const now = Date.now();
      const since = (now - toldAt) / 1000;

      asked.report({
        bytes,
        ofBytes: whole,
        bytesPerSecond: since > 0 ? Math.round((bytes - toldAbout) / since) : 0,
      });

      toldAt = now;
      toldAbout = bytes;
    };

    try {
      for (;;) {
        if (stopper.signal.aborted) {
          await reader.cancel();
          onto.end();
          await once(onto, 'finish');

          return { bytes, isComplete: false, failure: null };
        }

        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        bytes += value.byteLength;

        if (!onto.write(value)) {
          await once(onto, 'drain');
        }

        if (Date.now() - toldAt >= EVERY) {
          tell();
        }
      }

      onto.end();
      await once(onto, 'finish');

      return { bytes, isComplete: true, failure: null };
    } catch (problem) {
      onto.end();

      return {
        bytes,
        isComplete: false,
        failure: stopper.signal.aborted ? null : String(problem),
      };
    }
  };

  return {
    stop: () => {
      stopper.abort();
    },
    finished: run().catch((problem: Error) => ({
      bytes: asked.already,
      isComplete: false,
      failure: stopper.signal.aborted ? null : problem.message,
    })),
  };
};

export type { AskingTheServer, Fetching, Outcome, Progress, WhatToFetch };

export { keepADownload };
