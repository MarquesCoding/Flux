import { describe, expect, it } from 'vitest';
import { planToSessionSpec, selectEncoder } from './planToSessionSpec';
import type { Capabilities } from './planToSessionSpec';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const directPlay: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'passthrough', reason },
  video: { kind: 'passthrough', reason },
  audio: { kind: 'passthrough', streamIndex: 1, reason },
  subtitles: { kind: 'none', reason },
};

const capabilities: Capabilities = {
  toneMapping: 'zscale',
  canBurnTextSubtitles: true,
  canBurnImageSubtitles: true,
  encoders: [
    { codec: 'h264', encoder: 'h264_videotoolbox', accel: 'videotoolbox' },
    { codec: 'h264', encoder: 'libx264', accel: 'none' },
    { codec: 'hevc', encoder: 'libx265', accel: 'none' },
  ],
};

const softwareOnly: Capabilities = {
  toneMapping: 'zscale',
  canBurnTextSubtitles: true,
  canBurnImageSubtitles: true,
  encoders: [{ codec: 'h264', encoder: 'libx264', accel: 'none' }],
};

const noToneMapping: Capabilities = { ...capabilities, toneMapping: 'unavailable' };

const build = (plan: PlaybackPlan, caps: Capabilities = capabilities, sourceRange = 'SDR') =>
  planToSessionSpec({
    plan,
    inputPath: '/media/film.mkv',
    sourceRange,
    capabilities: caps,
    startSeconds: 0,
    segmentSeconds: 4,
  });

const transcodeVideo: PlaybackPlan['video'] = {
  kind: 'transcode',
  codec: 'h264',
  range: 'SDR',
  maxBitrateKbps: 8000,
  maxWidth: 1920,
  maxHeight: 1080,
  reason,
};

describe('selectEncoder', () => {
  it('prefers a hardware encoder', () => {
    expect(selectEncoder(capabilities, 'h264')?.encoder).toBe('h264_videotoolbox');
  });

  it('falls back to software', () => {
    expect(selectEncoder(capabilities, 'hevc')?.encoder).toBe('libx265');
  });

  it('reports nothing for a codec this machine cannot encode', () => {
    expect(selectEncoder(capabilities, 'av1')).toBeNull();
  });
});

describe('planToSessionSpec', () => {
  it('copies both streams for direct play', () => {
    const outcome = build(directPlay);

    expect(outcome).toMatchObject({
      kind: 'ok',
      spec: { video: { kind: 'copy' }, audio: { kind: 'copy' }, hardwareAccel: 'none' },
    });
  });

  it('does not ask for hardware when nothing is being encoded', () => {
    const outcome = build({ ...directPlay, container: { kind: 'remux', target: 'mp4', reason } });

    expect(outcome).toMatchObject({ kind: 'ok', spec: { hardwareAccel: 'none' } });
  });

  it('encodes audio alone without touching the video', () => {
    const outcome = build({
      ...directPlay,
      audio: {
        kind: 'transcode',
        streamIndex: 1,
        codec: 'aac',
        channels: 2,
        maxBitrateKbps: 256,
        reason,
      },
    });

    expect(outcome).toMatchObject({
      kind: 'ok',
      spec: {
        video: { kind: 'copy' },
        audio: { kind: 'encode', encoder: 'aac', channels: 2, maxBitrateKbps: 256 },
      },
    });
  });

  it('chooses a hardware encoder when the video must be re-encoded', () => {
    const outcome = build({ ...directPlay, video: transcodeVideo });

    expect(outcome).toMatchObject({
      kind: 'ok',
      spec: {
        hardwareAccel: 'videotoolbox',
        video: { kind: 'encode', encoder: 'h264_videotoolbox', maxWidth: 1920, maxHeight: 1080 },
      },
    });
  });

  it('uses software when no hardware encoder exists', () => {
    const outcome = build({ ...directPlay, video: transcodeVideo }, softwareOnly);

    expect(outcome).toMatchObject({
      kind: 'ok',
      spec: { hardwareAccel: 'none', video: { kind: 'encode', encoder: 'libx264' } },
    });
  });

  it('carries the negotiated limits through to the encoder', () => {
    const outcome = build({
      ...directPlay,
      video: { ...transcodeVideo, maxBitrateKbps: 3000, maxWidth: 1280, maxHeight: 720 },
    });

    expect(outcome).toMatchObject({
      kind: 'ok',
      spec: { video: { maxBitrateKbps: 3000, maxWidth: 1280, maxHeight: 720 } },
    });
  });

  it('burns in subtitles by encoding the video even when the video was acceptable', () => {
    const outcome = build({
      ...directPlay,
      subtitles: { kind: 'burnIn', streamIndex: 2, reason },
    });

    expect(outcome).toMatchObject({
      kind: 'ok',
      spec: { video: { kind: 'encode' } },
    });
  });

  it('does not encode the video for a sidecar subtitle', () => {
    const outcome = build({
      ...directPlay,
      subtitles: { kind: 'sidecar', streamIndex: 2, format: 'webvtt', reason },
    });

    expect(outcome).toMatchObject({ kind: 'ok', spec: { video: { kind: 'copy' } } });
  });

  it('falls back to h264 when the requested codec has no encoder', () => {
    const outcome = build(
      { ...directPlay, video: { ...transcodeVideo, codec: 'av1' } },
      softwareOnly,
    );

    expect(outcome).toMatchObject({ kind: 'ok', spec: { video: { encoder: 'libx264' } } });
  });

  it('tone maps when converting HDR to SDR', () => {
    const outcome = build({ ...directPlay, video: transcodeVideo }, capabilities, 'HDR10');

    expect(outcome).toMatchObject({ kind: 'ok', spec: { video: { toneMap: 'zscale' } } });
  });

  it('does not tone map an SDR source', () => {
    const outcome = build({ ...directPlay, video: transcodeVideo }, capabilities, 'SDR');

    expect(outcome).toMatchObject({ kind: 'ok' });
    expect(outcome.kind === 'ok' && 'toneMap' in outcome.spec.video).toBe(false);
  });

  it('does not tone map when the range is preserved', () => {
    const outcome = build(
      { ...directPlay, video: { ...transcodeVideo, range: 'HDR10' } },
      capabilities,
      'HDR10',
    );

    expect(outcome.kind === 'ok' && 'toneMap' in outcome.spec.video).toBe(false);
  });

  it('warns when the server cannot tone map, rather than failing silently', () => {
    const outcome = build({ ...directPlay, video: transcodeVideo }, noToneMapping, 'HDR10');

    expect(outcome).toMatchObject({ kind: 'ok' });
    expect(outcome.kind === 'ok' && outcome.warnings[0]).toMatch(/washed out/);
  });

  it('still produces a stream when it cannot tone map', () => {
    const outcome = build({ ...directPlay, video: transcodeVideo }, noToneMapping, 'HDR10');

    expect(outcome).toMatchObject({ kind: 'ok', spec: { video: { kind: 'encode' } } });
  });

  it('warns about nothing for an ordinary transcode', () => {
    const outcome = build({ ...directPlay, video: transcodeVideo }, capabilities, 'SDR');

    expect(outcome.kind === 'ok' && outcome.warnings).toEqual([]);
  });

  it('warns and drops subtitles rather than refusing to play', () => {
    const outcome = build(
      { ...directPlay, subtitles: { kind: 'burnIn', streamIndex: 2, reason } },
      { ...capabilities, canBurnTextSubtitles: false },
    );

    expect(outcome).toMatchObject({ kind: 'ok', spec: { subtitles: { kind: 'none' } } });
    expect(outcome.kind === 'ok' && outcome.warnings[0]).toMatch(/cannot burn in text subtitles/);
  });

  it('does not encode the video when the subtitles it would burn cannot be drawn', () => {
    const outcome = build(
      { ...directPlay, subtitles: { kind: 'burnIn', streamIndex: 2, reason } },
      { ...capabilities, canBurnTextSubtitles: false },
    );

    expect(outcome).toMatchObject({ kind: 'ok', spec: { video: { kind: 'copy' } } });
  });

  it('burns in subtitles when the server can', () => {
    const outcome = build({
      ...directPlay,
      subtitles: { kind: 'burnIn', streamIndex: 2, reason },
    });

    expect(outcome).toMatchObject({
      kind: 'ok',
      spec: { subtitles: { kind: 'burnIn', streamIndex: 2, isImageBased: false } },
    });
  });

  it('reports when the machine cannot encode at all', () => {
    const outcome = build({ ...directPlay, video: transcodeVideo }, { encoders: [] });

    expect(outcome).toMatchObject({ kind: 'unsupported' });
  });

  it('passes the seek position and segment length through', () => {
    const outcome = planToSessionSpec({
      plan: directPlay,
      inputPath: '/media/film.mkv',
      sourceRange: 'SDR',
      capabilities,
      startSeconds: 120,
      segmentSeconds: 6,
    });

    expect(outcome).toMatchObject({
      kind: 'ok',
      spec: { startSeconds: 120, segmentSeconds: 6, inputPath: '/media/film.mkv' },
    });
  });
});
