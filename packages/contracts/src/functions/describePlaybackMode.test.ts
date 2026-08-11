import { describe, expect, it } from 'vitest';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';
import { describePlaybackMode } from './describePlaybackMode';
const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const directPlay: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'passthrough', reason },
  video: { kind: 'passthrough', reason },
  audio: { kind: 'passthrough', streamIndex: 1, reason },
  subtitles: { kind: 'none', reason },
};

describe('describePlaybackMode', () => {
  it('reports DirectPlay when every axis passes through', () => {
    expect(describePlaybackMode(directPlay)).toBe('DirectPlay');
  });

  it('reports Remux when only the container changes', () => {
    const plan: PlaybackPlan = {
      ...directPlay,
      container: { kind: 'remux', target: 'mp4', reason },
    };

    expect(describePlaybackMode(plan)).toBe('Remux');
  });

  it('reports DirectStream when only the audio is re-encoded', () => {
    const plan: PlaybackPlan = {
      ...directPlay,
      audio: {
        kind: 'transcode',
        streamIndex: 1,
        codec: 'aac',
        channels: 2,
        maxBitrateKbps: 256,
        reason,
      },
    };

    expect(describePlaybackMode(plan)).toBe('DirectStream');
  });

  it('reports Transcode when the video is re-encoded', () => {
    const plan: PlaybackPlan = {
      ...directPlay,
      video: {
        kind: 'transcode',
        codec: 'h264',
        range: 'SDR',
        maxBitrateKbps: 8000,
        maxWidth: 1920,
        maxHeight: 1080,
        reason,
      },
    };

    expect(describePlaybackMode(plan)).toBe('Transcode');
  });

  it('reports Transcode when subtitles must be burned in', () => {
    const plan: PlaybackPlan = {
      ...directPlay,
      subtitles: { kind: 'burnIn', streamIndex: 2, reason },
    };

    expect(describePlaybackMode(plan)).toBe('Transcode');
  });

  it('does not report DirectStream when video already forces a transcode', () => {
    const plan: PlaybackPlan = {
      ...directPlay,
      video: {
        kind: 'transcode',
        codec: 'h264',
        range: 'SDR',
        maxBitrateKbps: 8000,
        maxWidth: 1920,
        maxHeight: 1080,
        reason,
      },
      audio: {
        kind: 'transcode',
        streamIndex: 1,
        codec: 'aac',
        channels: 2,
        maxBitrateKbps: 256,
        reason,
      },
    };

    expect(describePlaybackMode(plan)).toBe('Transcode');
  });
});
