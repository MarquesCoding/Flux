/**
 * What each kind of work is called, in words an operator reads.
 *
 * Two vocabularies land here and both are real. A job this page started is
 * named by the coordinator ("scan", "rescan"); a job picked up after a reload
 * is named by the queue that is running it ("library.scan"), because that is
 * all the server knows to call it. Reading only the first meant a scan
 * rejoined after a refresh was labelled as something else entirely.
 */
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
 *
 * Falls back to "Working on", since a kind nobody has words for is still work
 * happening — better a vague label on a real progress bar than a confident
 * wrong one.
 */
const describeScanKind = (kind: string, libraryName: string): string =>
  `${WORDS[kind] ?? 'Working on'} ${libraryName}`;

export { describeScanKind };
