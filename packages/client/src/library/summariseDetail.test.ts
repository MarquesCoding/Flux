import { describe, expect, it } from 'vitest';
import { summariseDetail } from './summariseDetail';
import type { MediaDetail } from '@ValenceContracts/schemas/Library';

const detail = (overrides: Partial<MediaDetail> = {}): MediaDetail => ({
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  videoBitDepth: 10,
  canCopySegments: true,
  videoIsInterlaced: false,
  width: 3840,
  height: 2160,
  bitrateKbps: 24000,
  audioStreams: [{ index: 1, codec: 'aac', channels: 2, isDefault: true, isAtmos: false }],
  subtitleStreams: [],
  addedAt: '2026-08-10T00:00:00.000Z',
  metadata: { hasPoster: true, hasBackdrop: true, hasLogo: false },
  ...overrides,
});

describe('summariseDetail', () => {
  it('keeps what a page needs to draw the item', () => {
    const summary = summariseDetail(detail());

    expect(summary).toMatchObject({
      id: '9c858901-8a57-4791-81fe-4c455b099bc9',
      title: 'Arrival',
      year: 2016,
      durationSeconds: 7200,
      height: 2160,
      hasPoster: true,
      hasBackdrop: true,
      hasLogo: false,
    });
  });

  it('carries the programme an episode belongs to', () => {
    const summary = summariseDetail(
      detail({
        title: 'Pilot',
        metadata: {
          hasPoster: false,
          hasBackdrop: false,
          hasLogo: false,
          seriesTitle: 'Ted Lasso',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      }),
    );

    expect(summary).toMatchObject({ seriesTitle: 'Ted Lasso', seasonNumber: 1, episodeNumber: 1 });
  });

  it('says nothing about a series identifier rather than inventing one', () => {
    expect(summariseDetail(detail()).seriesId).toBeNull();
  });

  it('answers with nothing where a catalogue said nothing, rather than leaving gaps', () => {
    const summary = summariseDetail(detail({ year: null }));

    expect(summary.year).toBeNull();
    expect(summary.rating).toBeNull();
    expect(summary.genres).toBeNull();
  });
});
