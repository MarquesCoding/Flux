/**
 * What the media service calls a piece of work, in words an operator reads.
 *
 * The queue labels its own slots for its own purposes — `fingerprint` is the
 * right name for reducing audio to hashes, and the Rust that does it should go
 * on calling it that. It is only wrong on a page, where it names a technique to
 * somebody who wants to know what is happening to their file.
 *
 * Phrased as what is being done rather than what it is called, because these sit
 * under a filename in a list of work in progress.
 *
 * Kept apart from the scan's phase labels deliberately: that is a different
 * vocabulary from a different service, and merging them would mean one map
 * pretending two unrelated sets of strings are one.
 */
const QUEUE_KIND_LABELS: Record<string, string> = {
  preview: 'Making a preview',
  thumbnails: 'Drawing scrub previews',
  fingerprint: 'Comparing episode audio',
};

/**
 * Names a queue entry, falling back to whatever the service called it.
 *
 * An unknown kind is shown rather than hidden. A new kind of work appearing
 * under its internal name is untidy; a row that silently says nothing about what
 * the machine is doing is worse.
 */
const describeQueueKind = (kind: string): string => QUEUE_KIND_LABELS[kind] ?? kind;

export { describeQueueKind };
