import { describe, expect, it } from 'vitest';
import { describeQueueKind } from './describeQueueKind';

describe('naming a piece of work in the queue', () => {
  it('says what fingerprinting is for rather than what it is called', () => {
    expect(describeQueueKind('fingerprint')).toBe('Comparing episode audio');
  });

  it('calls the seek-bar strip scrub previews, not thumbnails', () => {
    const said = describeQueueKind('thumbnails');

    expect(said).toBe('Drawing scrub previews');
    expect(said).not.toMatch(/thumbnail/i);
  });

  it('does not call anything trickplay, which means nothing to most people', () => {
    for (const kind of ['preview', 'thumbnails', 'fingerprint']) {
      expect(describeQueueKind(kind)).not.toMatch(/trickplay/i);
    }
  });

  it('names the preview clip', () => {
    expect(describeQueueKind('preview')).toBe('Making a preview');
  });

  it('shows an unfamiliar kind rather than hiding it', () => {
    expect(describeQueueKind('something-new')).toBe('something-new');
  });
});
