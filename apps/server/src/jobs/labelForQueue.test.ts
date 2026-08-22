import { describe, expect, it } from 'vitest';
import { labelForQueue } from './labelForQueue';

describe('labelForQueue', () => {
  it('names a job the way an operator would say it', () => {
    expect(labelForQueue('server.checkTranscoder')).toBe('Check the transcoder');
  });

  it('names the queue a library job fires its schedule on', () => {
    expect(labelForQueue('library.scan.scheduled')).toBe('Scan for changes');
  });

  it('names the queue a library job itself runs on', () => {
    expect(labelForQueue('library.scan')).toBe('Scan for changes');
  });

  it('falls back to the name of the queue itself rather than to nothing', () => {
    expect(labelForQueue('webhook.deliver')).toBe('webhook.deliver');
  });
});
