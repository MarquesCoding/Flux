import type { HeldFiles } from '@ValenceClient/platform/Platform.types';

/**
 * What a client that cannot keep a file answers when asked what it is holding.
 *
 * A browser is the case this exists for. Its storage is a quota rather than a disk, eviction needs
 * no warning, and a transfer cannot outlive the tab — so nothing is ever held, and the honest
 * answer to every question is that there is nothing here.
 *
 * Refusing outright rather than answering emptily would be worse: the screens that ask are the same
 * screens either way, and one that has to know which client it is running on to avoid asking is a
 * screen that knows too much.
 *
 * @returns Somewhere nothing is kept.
 */
const noFilesAreKept = (): HeldFiles => ({
  all: () => Promise.resolve([]),
  keep: () => Promise.resolve(),
  drop: () => Promise.resolve(),
  pause: () => Promise.resolve(),
  sourceFor: () => '',
  posterFor: () => '',
  whenChanged: () => () => {},
});

export { noFilesAreKept };
