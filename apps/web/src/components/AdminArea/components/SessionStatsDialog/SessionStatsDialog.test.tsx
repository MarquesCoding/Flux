import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionStatsDialog } from './SessionStatsDialog';
import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const PLAN: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: {
    kind: 'remux',
    target: 'mp4',
    reason: { code: 'ContainerNotSupported', detail: 'Client does not support mkv' },
  },
  video: {
    kind: 'transcode',
    codec: 'h264',
    range: 'SDR',
    maxBitrateKbps: 8000,
    maxWidth: 1920,
    maxHeight: 1080,
    reason: { code: 'VideoCodecNotSupported', detail: 'Client does not support hevc' },
  },
  audio: { kind: 'passthrough', streamIndex: 1, reason },
  subtitles: { kind: 'none', reason },
};

const WATCHING_SESSION: ActiveSession = {
  clientId: 'tab-1',
  profileId: 'profile-1',
  profileName: 'Dan',
  deviceLabel: 'Chrome on macOS',
  connectedAt: 1000,
  playback: {
    mediaId: 'media-1',
    mediaTitle: 'Arrival',
    hasPoster: true,
    hasBackdrop: false,
    mode: 'transcode',
    plan: PLAN,
    isPlaying: true,
    pausedByAdmin: false,
    startedAt: 1500,
    health: null,
  },
};

const IDLE_SESSION: ActiveSession = { ...WATCHING_SESSION, playback: null };

describe('SessionStatsDialog', () => {
  it('shows what is playing and how', () => {
    render(<SessionStatsDialog session={WATCHING_SESSION} isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Arrival')).toBeInTheDocument();
    expect(screen.getByText(/Transcoding/)).toBeInTheDocument();
    expect(screen.getByText('Playing')).toBeInTheDocument();
  });

  it('names the device and viewer', () => {
    render(<SessionStatsDialog session={WATCHING_SESSION} isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Chrome on macOS')).toBeInTheDocument();
    expect(screen.getByText('Dan')).toBeInTheDocument();
  });

  it('says when a stream was paused by an admin, not just that it is paused', () => {
    const session: ActiveSession = {
      ...WATCHING_SESSION,
      playback:
        WATCHING_SESSION.playback === null
          ? null
          : { ...WATCHING_SESSION.playback, isPlaying: false, pausedByAdmin: true },
    };

    render(<SessionStatsDialog session={session} isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Paused by an admin')).toBeInTheDocument();
  });

  it('says when nothing is playing rather than showing empty fields', () => {
    render(<SessionStatsDialog session={IDLE_SESSION} isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Nothing right now')).toBeInTheDocument();
  });

  it('explains what is being converted and why, axis by axis', () => {
    render(<SessionStatsDialog session={WATCHING_SESSION} isOpen onClose={vi.fn()} />);

    expect(screen.getByText(/remux — Client does not support mkv/)).toBeInTheDocument();
    expect(
      screen.getByText(/transcode — Client does not support hevc \(1920x1080 @ 8000kbps\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/passthrough — Client declares support/)).toBeInTheDocument();
  });

  it('says buffer has not been reported yet before the first heartbeat carries one', () => {
    render(<SessionStatsDialog session={WATCHING_SESSION} isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Not reported yet')).toBeInTheDocument();
  });

  it('shows the buffer and picture size the player last reported', () => {
    const session: ActiveSession = {
      ...WATCHING_SESSION,
      playback:
        WATCHING_SESSION.playback === null
          ? null
          : {
              ...WATCHING_SESSION.playback,
              health: {
                positionSeconds: 600,
                durationSeconds: 7200,
                bufferedAheadSeconds: 12.4,
                presentedWidth: 1920,
                presentedHeight: 1080,
              },
            },
    };

    render(<SessionStatsDialog session={session} isOpen onClose={vi.fn()} />);

    expect(screen.getByText('12.4s ahead')).toBeInTheDocument();
    expect(screen.getByText('1920x1080')).toBeInTheDocument();
  });

  it('can be closed', async () => {
    const onClose = vi.fn();
    const actor = userEvent.setup();

    render(<SessionStatsDialog session={WATCHING_SESSION} isOpen onClose={onClose} />);
    await actor.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });
});
