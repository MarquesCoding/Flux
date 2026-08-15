const WORDS: Record<string, string> = {
  scan: 'Scanning',
  rescan: 'Reading every file in',
  regeneratePreviews: 'Regenerating previews for',
  'library.scan': 'Scanning',
  'library.readAgain': 'Reading the corrected files in',
  'library.regeneratePreviews': 'Regenerating previews for',
  'library.regenerateTrickplay': 'Regenerating thumbnails for',
  'library.detectSegments': 'Detecting intros in',
  'library.reset': 'Rebuilding',
};

/**
 * Names the work running against a library.
 */
const describeScanKind = (kind: string, libraryName: string): string =>
  `${WORDS[kind] ?? 'Working on'} ${libraryName}`;

export { describeScanKind };
