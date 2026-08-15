const QUEUE_KIND_LABELS: Record<string, string> = {
  preview: 'Making a preview',
  thumbnails: 'Drawing scrub previews',
  fingerprint: 'Comparing episode audio',
};

/**
 * Names a queue entry, falling back to whatever the service called it.
 */
const describeQueueKind = (kind: string): string => QUEUE_KIND_LABELS[kind] ?? kind;

export { describeQueueKind };
