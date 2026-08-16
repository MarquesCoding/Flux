const QUEUE_KIND_LABELS: Record<string, string> = {
  preview: 'Making a preview',
  thumbnails: 'Drawing scrub previews',
  fingerprint: 'Comparing episode audio',
};

/**
 * Names a queue entry in words rather than in the identifier the service uses, falling back to that
 * identifier for any kind added since — an unfamiliar name is more use than a blank.
 *
 * @param kind - The queue entry's kind, as the service reports it.
 * @returns What to call it.
 */
const describeQueueKind = (kind: string): string => QUEUE_KIND_LABELS[kind] ?? kind;

export { describeQueueKind };
