import Conf from 'conf';
import { HeldFileSchema } from '@ValenceContracts/schemas/HeldFile';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';
import { JsonValueSchema } from '@ValenceContracts/schemas/JsonValue';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

let opened: Conf<Record<string, JsonValue>> | null = null;

type HeldIndex = {
  all: () => HeldFile[];
  read: (downloadId: string) => HeldFile | null;
  write: (file: HeldFile) => void;
  forget: (downloadId: string) => void;
};

/**
 * What this machine knows about the files it is holding, without asking the server.
 *
 * This is the part that makes offline mean anything. A file on the disk with no title, no
 * programme, no length and no artwork is not something anybody can be offered — it is a name in a
 * folder. What is kept here is the little that has to be true to draw a shelf of downloads and a
 * player: what it is, what it belongs to, how long it runs, how much of it has arrived.
 *
 * Deliberately not a copy of the catalogue. Offline mode shows what is on this disk and nothing
 * else, so what is worth mirroring is bounded by what somebody actually downloaded rather than by
 * how large their library is.
 *
 * A row that no longer parses is dropped rather than repaired. This file is written by one process
 * and read by one process, so a row that has gone wrong has gone wrong on the disk — and a download
 * that quietly disappears from a list is a far better failure than a screen that will not draw.
 *
 * @returns The index, as four things that can be done to it.
 */
const theHeldIndex = (): HeldIndex => {
  opened ??= new Conf<Record<string, JsonValue>>({
    projectName: 'valence',
    configName: 'held',
    accessPropertiesByDotNotation: false,
  });

  const held = opened;

  return {
    all: () =>
      Object.values(held.store).flatMap((row) => {
        const read = HeldFileSchema.safeParse(row);

        return read.success ? [read.data] : [];
      }),
    read: (downloadId) => {
      const read = HeldFileSchema.safeParse(held.get(downloadId));

      return read.success ? read.data : null;
    },
    write: (file) => {
      held.set(file.downloadId, JsonValueSchema.parse(file));
    },
    forget: (downloadId) => {
      held.delete(downloadId);
    },
  };
};

export type { HeldIndex };

export { theHeldIndex };
