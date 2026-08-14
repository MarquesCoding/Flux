import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionCard } from './SessionCard';
import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';

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

  it('sends a message without touching what is playing', async () => {
    const onMessage = vi.fn();
    const onPause = vi.fn();
    const onStop = vi.fn();

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
    await userEvent.click(screen.getByRole('button', { name: 'Message' }));
    await userEvent.type(screen.getByLabelText('Message for Dan'), 'Dinner is ready.');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(onMessage).toHaveBeenCalledWith('Dinner is ready.');
    expect(onPause).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });

  it('offers nobody to message in a tab that is watching nothing', () => {
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

    expect(container.querySelector('.bg-accent')).not.toBeInTheDocument();
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

    const position = container.querySelector('.bg-accent');
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
});
