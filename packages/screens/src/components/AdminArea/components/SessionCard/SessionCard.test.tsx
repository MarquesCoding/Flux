import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionCard } from './SessionCard';
import type { ActiveSession } from '@ValenceClient/admin/fetchAdmin';
import type { PlaybackPlan, Reason } from '@ValenceContracts/schemas/PlaybackPlan';

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const PLAN: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'passthrough', reason },
  video: { kind: 'passthrough', reason },
  audio: { kind: 'passthrough', streamIndex: 1, reason },
  subtitles: { kind: 'none', reason },
};

const IDLE_SESSION: ActiveSession = {
  clientId: 'tab-1',
  profileId: 'profile-1',
  profileName: 'Dan',
  deviceLabel: 'Living room TV',
  connectedAt: 1000,
  playback: null,
};

const WATCHING_SESSION: ActiveSession = {
  ...IDLE_SESSION,
  playback: {
    mediaId: 'media-1',
    mediaTitle: 'Arrival',
    hasPoster: true,
    hasBackdrop: false,
    mode: 'transcode',
    plan: PLAN,
    reuse: 'none',
    isPlaying: true,
    pausedByAdmin: false,
    startedAt: 1500,
    health: null,
  },
};

describe('SessionCard', () => {
  it('shows the device for a tab that is not watching anything', () => {
    render(
      <SessionCard
        session={IDLE_SESSION}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    expect(screen.getByText('Living room TV')).toBeInTheDocument();
    expect(screen.getByText('Not watching anything')).toBeInTheDocument();
  });

  it('offers no playback controls when nothing is playing', () => {
    render(
      <SessionCard
        session={IDLE_SESSION}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Pause|Stop/ })).not.toBeInTheDocument();
  });

  it('shows no reuse badge for a transcode this session is paying for', () => {
    render(
      <SessionCard
        session={WATCHING_SESSION}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    expect(screen.queryByText('Cached')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared')).not.toBeInTheDocument();
  });

  it('marks a session playing a transcode that was already made', () => {
    const session: ActiveSession = {
      ...WATCHING_SESSION,
      playback:
        WATCHING_SESSION.playback === null
          ? null
          : { ...WATCHING_SESSION.playback, reuse: 'whole' },
    };

    render(
      <SessionCard
        session={session}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    expect(screen.getByText('Cached')).toBeInTheDocument();
  });

  it('marks a session riding on another viewer’s encoder', () => {
    const session: ActiveSession = {
      ...WATCHING_SESSION,
      playback:
        WATCHING_SESSION.playback === null
          ? null
          : { ...WATCHING_SESSION.playback, reuse: 'shared' },
    };

    render(
      <SessionCard
        session={session}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    expect(screen.getByText('Shared')).toBeInTheDocument();
  });

  it('shows no reuse badge for a part-finished directory, which saves no encoder', () => {
    const session: ActiveSession = {
      ...WATCHING_SESSION,
      playback:
        WATCHING_SESSION.playback === null
          ? null
          : { ...WATCHING_SESSION.playback, reuse: 'partial' },
    };

    render(
      <SessionCard
        session={session}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    expect(screen.queryByText('Cached')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared')).not.toBeInTheDocument();
  });

  it('shows what a tab is watching, and how', () => {
    render(
      <SessionCard
        session={WATCHING_SESSION}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    expect(screen.getByText(/Arrival/)).toBeInTheDocument();
    expect(screen.getByText(/Transcoding/)).toBeInTheDocument();
  });

  it('stops a stream on request', async () => {
    const onStop = vi.fn();

    render(
      <SessionCard
        session={WATCHING_SESSION}
        isBusy={false}
        onStop={onStop}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Stop/ }));

    expect(onStop).toHaveBeenCalled();
  });

  it('offers to pause a stream that is playing', async () => {
    const onPause = vi.fn();

    render(
      <SessionCard
        session={WATCHING_SESSION}
        isBusy={false}
        onStop={vi.fn()}
        onPause={onPause}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Pause/ }));

    expect(onPause).toHaveBeenCalled();
  });

  it('offers to resume a stream an admin already paused', async () => {
    const onResume = vi.fn();
    const pausedSession: ActiveSession = {
      ...WATCHING_SESSION,
      playback:
        WATCHING_SESSION.playback === null
          ? null
          : { ...WATCHING_SESSION.playback, pausedByAdmin: true, isPlaying: false },
    };

    render(
      <SessionCard
        session={pausedSession}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={onResume}
        onMessage={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Play/ }));

    expect(onResume).toHaveBeenCalled();
  });

  it('shows no progress bar until the player has reported its position', () => {
    const { container } = render(
      <SessionCard
        session={WATCHING_SESSION}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    expect(container.querySelector('.bg-primary')).not.toBeInTheDocument();
  });

  it('draws the position and buffer as widths of how far through the film they are', () => {
    const session: ActiveSession = {
      ...WATCHING_SESSION,
      playback:
        WATCHING_SESSION.playback === null
          ? null
          : {
              ...WATCHING_SESSION.playback,
              health: {
                positionSeconds: 1800,
                durationSeconds: 7200,
                bufferedAheadSeconds: 900,
                presentedWidth: 1920,
                presentedHeight: 1080,
              },
            },
    };

    const { container } = render(
      <SessionCard
        session={session}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    const position = container.querySelector('.bg-primary');
    const buffer = container.querySelector('.bg-text\\/25');

    expect(position).toHaveStyle({ width: '25%' });
    expect(buffer).toHaveStyle({ width: '37.5%' });
  });

  it('offers a working play button when a viewer paused it themselves', async () => {
    const onResume = vi.fn();
    const selfPausedSession: ActiveSession = {
      ...WATCHING_SESSION,
      playback:
        WATCHING_SESSION.playback === null
          ? null
          : { ...WATCHING_SESSION.playback, pausedByAdmin: false, isPlaying: false },
    };

    render(
      <SessionCard
        session={selfPausedSession}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={onResume}
        onMessage={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Play/ }));

    expect(onResume).toHaveBeenCalled();
  });

  it('offers a way to message somebody who is watching', () => {
    render(
      <SessionCard
        session={WATCHING_SESSION}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Message' })).toBeInTheDocument();
  });

  it('asks to message without stopping or pausing anything', async () => {
    const actor = userEvent.setup();
    const onMessage = vi.fn();
    const onStop = vi.fn();
    const onPause = vi.fn();

    render(
      <SessionCard
        session={WATCHING_SESSION}
        isBusy={false}
        onStop={onStop}
        onPause={onPause}
        onResume={vi.fn()}
        onMessage={onMessage}
      />,
    );

    await actor.click(screen.getByRole('button', { name: 'Message' }));

    expect(onMessage).toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
    expect(onPause).not.toHaveBeenCalled();
  });

  it('offers no message button for a tab watching nothing, which has no banner to draw', () => {
    render(
      <SessionCard
        session={IDLE_SESSION}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Message' })).not.toBeInTheDocument();
  });

  it('opens the stats for a stream, and closes them again', async () => {
    const actor = userEvent.setup();

    render(
      <SessionCard
        session={WATCHING_SESSION}
        isBusy={false}
        onStop={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    await actor.click(screen.getByRole('button', { name: 'Stream stats' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await actor.click(screen.getByRole('button', { name: /^Close$/ }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
