import { describe, expect, it } from 'vitest';
import { announcesCompletion } from './announcesCompletion';

describe('announcesCompletion', () => {
  it('leaves a scan to library.scanned, which says what it found and covers the whole run', () => {
    expect(announcesCompletion('library.scan')).toBe(false);
    expect(announcesCompletion('library.scan.scheduled')).toBe(false);
  });

  it('announces the artefacts a library builds', () => {
    expect(announcesCompletion('library.regeneratePreviews')).toBe(true);
    expect(announcesCompletion('library.regenerateTrickplay')).toBe(true);
    expect(announcesCompletion('library.detectSegments')).toBe(true);
    expect(announcesCompletion('library.fetchLogos')).toBe(true);
  });

  it('says nothing about checking the transcoder, which happens every five minutes', () => {
    expect(announcesCompletion('server.checkTranscoder')).toBe(false);
  });

  it('says nothing about the rest of the upkeep either', () => {
    expect(announcesCompletion('server.checkDiskSpace')).toBe(false);
    expect(announcesCompletion('server.cleanupSessions')).toBe(false);
    expect(announcesCompletion('server.pruneLogs')).toBe(false);
    expect(announcesCompletion('server.sendMediaDigest')).toBe(false);
  });

  it('says nothing about machinery the catalogue has never heard of', () => {
    expect(announcesCompletion('library.readAgain')).toBe(false);
    expect(announcesCompletion('server.stallCanary')).toBe(false);
    expect(announcesCompletion('webhook.deliver')).toBe(false);
  });

  it('never announces something it could only name by its queue', () => {
    expect(announcesCompletion('some.future.queue')).toBe(false);
  });

  it('answers for the queue a schedule fires on as well as the job itself', () => {
    expect(announcesCompletion('library.detectSegments.scheduled')).toBe(true);
  });
});
