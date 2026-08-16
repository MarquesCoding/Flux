import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StreamStats } from './StreamStats';
import type { PlaybackHealth, StreamStatsProps } from './StreamStats.types';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';
import type { MediaDetail } from '@FluxContracts/schemas/Library';

const reason: Reason = {
  code: 'VideoCodecNotSupported',
  detail: 'Client does not support hevc',
};

const plan: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'remux', target: 'mp4', reason },
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
    maxBitrateKbps: 192,
    reason,
  },
  subtitles: { kind: 'none', reason },
};

const detail: MediaDetail = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  videoBitDepth: 8,
  canCopySegments: true,
  width: 1920,
  height: 1040,
  bitrateKbps: 3308,
  audioStreams: [
    { index: 1, codec: 'aac', channels: 6, language: 'eng', isDefault: true, isAtmos: false },
  ],
  subtitleStreams: [{ index: 2, format: 'srt', language: 'eng', isForced: false }],
  addedAt: '2026-01-01T00:00:00.000Z',
  metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false },
};

const health: PlaybackHealth = {
  positionSeconds: 65,
  bufferedAheadSeconds: 12.25,
  encodedSeconds: 240,
  droppedFrames: 4,
  decodedFrames: 900,
  presentedWidth: 1920,
  presentedHeight: 1040,
};

const draw = (overrides: Partial<StreamStatsProps> = {}) => {
  const props: StreamStatsProps = {
    media: { id: 'media-1', title: 'Arrival', durationSeconds: 7200 },
    session: {
      sessionId: 'abc',
      delivery: { kind: 'hls', manifestUrl: '/api/playback/session/abc/index.m3u8' },
      mode: 'Transcode',
      plan,
      warnings: [],
    },
    detail,
    health,
    sessionStartSeconds: 0,
    onClose: vi.fn(),
    ...overrides,
  };

  render(<StreamStats {...props} />);

  return props;
};

describe('StreamStats', () => {
  it('names itself so it can be found and dismissed', () => {
    draw();

    expect(screen.getByRole('region', { name: 'Stats for nerds' })).toBeInTheDocument();
  });

  it('reports the session and how it is being delivered', () => {
    draw();

    expect(screen.getByText('abc')).toBeInTheDocument();
    expect(screen.getByText(/HLS — \/api\/playback\/session\/abc/)).toBeInTheDocument();
  });

  it('reports the decision on every axis with the reason behind it', () => {
    draw();

    expect(screen.getByText(/^remux —/)).toBeInTheDocument();
    expect(screen.getAllByText(/^transcode — Client does not support hevc/)).toHaveLength(2);
    expect(screen.getByText(/^none —/)).toBeInTheDocument();
  });

  it('shows the resolution and bitrate ceiling a video transcode is targeting', () => {
    draw();

    expect(screen.getByText(/\(1920x1080 @ 8000kbps\)/)).toBeInTheDocument();
  });

  it('shows the bitrate ceiling an audio transcode is targeting', () => {
    draw();

    expect(screen.getByText(/\(192kbps\)/)).toBeInTheDocument();
  });

  it('shows no ceiling for an axis that passes through', () => {
    draw({
      session: {
        sessionId: 'abc',
        delivery: { kind: 'direct', url: '/api/playback/media-1/file' },
        mode: 'DirectPlay',
        plan: {
          ...plan,
          video: { kind: 'passthrough', reason },
          audio: { kind: 'passthrough', streamIndex: 1, reason },
        },
        warnings: [],
      },
    });

    expect(screen.queryByText(/kbps\)/)).not.toBeInTheDocument();
  });

  it('reports what the source actually is', () => {
    draw();

    expect(screen.getByText(/1920x1040 HDR10/)).toBeInTheDocument();
    expect(screen.getByText(/aac 6ch/)).toBeInTheDocument();
  });

  it('reports how many frames the browser is dropping', () => {
    draw();

    expect(screen.getByText('4 of 900')).toBeInTheDocument();
  });

  it('says frames are not counted rather than claiming none were dropped', () => {
    draw({ health: { ...health, droppedFrames: null, decodedFrames: null } });

    expect(screen.getByText('not reported')).toBeInTheDocument();
  });

  it('reports how much is buffered and how much exists', () => {
    draw();

    expect(screen.getByText('12.3s')).toBeInTheDocument();
    expect(screen.getByText('240.0s')).toBeInTheDocument();
  });

  it('reports where in the film a seeked session starts', () => {
    draw({ sessionStartSeconds: 3600 });

    expect(screen.getByText('1:00:00')).toBeInTheDocument();
  });

  it('says what it does not know yet rather than showing blanks', () => {
    draw({ session: null, detail: null });

    expect(screen.getByText('not started')).toBeInTheDocument();
    expect(screen.getAllByText('deciding').length).toBeGreaterThan(0);
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });

  it('surfaces warnings the server attached to the session', () => {
    draw({
      session: {
        sessionId: 'abc',
        delivery: { kind: 'direct', url: '/api/playback/media-1/file' },
        mode: 'DirectPlay',
        plan,
        warnings: ['This server cannot tone map HDR to SDR.'],
      },
    });

    expect(screen.getByText(/cannot tone map/)).toBeInTheDocument();
  });

  it('closes on request', async () => {
    const user = userEvent.setup();
    const props = draw();

    await user.click(screen.getByRole('button', { name: 'Close stats' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('sets a display name so devtools can identify it', () => {
    expect(StreamStats.displayName).toBe('StreamStats');
  });
});
