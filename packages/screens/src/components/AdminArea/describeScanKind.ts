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
 * Names the work running against a library as a phrase reading into the library's own name, so the
 * progress bar says what is happening to what rather than pairing a code with a name.
 *
 * @param kind - The work being done, as the server reports it.
 * @param libraryName - The library it is being done to.
 * @returns The phrase to show.
 */
const describeScanKind = (kind: string, libraryName: string): string =>
  `${WORDS[kind] ?? 'Working on'} ${libraryName}`;

export { describeScanKind };
