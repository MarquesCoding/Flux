import { describe, expect, it } from 'vitest';
import { HeldFileListSchema, HeldFileSchema, WhatToKeepSchema } from './HeldFile';

const asked = {
  downloadId: '2b2b7f7e-2f0e-4a5e-9c2f-2b9b1e1f0a11',
  mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  title: 'The Third Man',
  quality: 'original',
};

const onDisk = {
  ...asked,
  seriesId: null,
  seriesTitle: null,
  durationSeconds: 5940,
  ofBytes: 4_200_000_000,
  state: 'here',
  bytes: 4_200_000_000,
  bytesPerSecond: null,
  failure: null,
  keptAt: '2026-08-22T00:00:00.000Z',
  hasPoster: true,
};

describe('WhatToKeepSchema', () => {
  it('accepts the little a screen knows when it asks for something to be kept', () => {
    expect(WhatToKeepSchema.parse(asked).title).toBe('The Third Man');
  });

  it('treats a film as a programme with nothing around it', () => {
    expect(WhatToKeepSchema.parse(asked).seriesId).toBeNull();
  });

  it('allows a size nobody knows yet, because the server may still be preparing it', () => {
    expect(WhatToKeepSchema.parse(asked).ofBytes).toBeNull();
  });

  it('insists the download is named the way the server names one', () => {
    expect(() =>
      WhatToKeepSchema.parse({ ...asked, downloadId: 'the-one-from-last-night' }),
    ).toThrow();
  });

  it('refuses a rung that is not one Valence offers', () => {
    expect(() => WhatToKeepSchema.parse({ ...asked, quality: 'enormous' })).toThrow();
  });
});

describe('HeldFileSchema', () => {
  it('accepts something that has finished arriving', () => {
    expect(HeldFileSchema.parse(onDisk).state).toBe('here');
  });

  it('carries how much is down as well as how much there is', () => {
    const read = HeldFileSchema.parse({ ...onDisk, state: 'fetching', bytes: 1_000 });

    expect([read.bytes, read.ofBytes]).toEqual([1_000, 4_200_000_000]);
  });

  it('says nothing about speed for something that is not moving', () => {
    expect(HeldFileSchema.parse(onDisk).bytesPerSecond).toBeNull();
  });

  it('carries why something failed, so a screen can say', () => {
    const read = HeldFileSchema.parse({ ...onDisk, state: 'failed', failure: 'The disk is full.' });

    expect(read.failure).toBe('The disk is full.');
  });

  it('assumes no artwork rather than a broken image', () => {
    const { hasPoster, ...without } = onDisk;

    expect([hasPoster, HeldFileSchema.parse(without).hasPoster]).toEqual([true, false]);
  });

  it('refuses a state that is not one of the four', () => {
    expect(() => HeldFileSchema.parse({ ...onDisk, state: 'downloading' })).toThrow();
  });
});

describe('HeldFileListSchema', () => {
  it('accepts a list of them', () => {
    expect(HeldFileListSchema.parse({ held: [onDisk] }).held).toHaveLength(1);
  });

  it('accepts an empty disk, which is what everybody starts with', () => {
    expect(HeldFileListSchema.parse({ held: [] }).held).toEqual([]);
  });
});
