import { describe, expect, it } from 'vitest';
import { noFilesAreKept } from './noFilesAreKept';

describe('noFilesAreKept', () => {
  it('holds nothing', async () => {
    await expect(noFilesAreKept().all()).resolves.toEqual([]);
  });

  it('takes an ask to keep something without complaint, and keeps nothing', async () => {
    const nowhere = noFilesAreKept();

    await nowhere.keep({
      downloadId: '2b2b7f7e-2f0e-4a5e-9c2f-2b9b1e1f0a11',
      mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
      seriesId: null,
      seriesTitle: null,
      title: 'The Third Man',
      quality: 'original',
      durationSeconds: null,
      ofBytes: null,
    });

    await expect(nowhere.all()).resolves.toEqual([]);
  });

  it('offers no address to play, because there is no file behind one', () => {
    expect(noFilesAreKept().sourceFor('2b2b7f7e-2f0e-4a5e-9c2f-2b9b1e1f0a11')).toBe('');
  });

  it('hands back a way to stop listening, so a screen can unmount cleanly', () => {
    expect(() => noFilesAreKept().whenChanged(() => {})()).not.toThrow();
  });
});
