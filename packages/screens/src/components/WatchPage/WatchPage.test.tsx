import { screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAShell } from '@FluxScreens/testing/renderInAShell';
import { aShell } from '@FluxClient/testing/aShell';
import { WatchPage } from './WatchPage';
import type { VideoPlayerProps } from '@FluxScreens/components/VideoPlayer/VideoPlayer.types';

const drawn = vi.hoisted((): { player: VideoPlayerProps | null } => ({ player: null }));

vi.mock('@FluxScreens/components/VideoPlayer/VideoPlayer', () => ({
  VideoPlayer: (props: VideoPlayerProps) => {
    drawn.player = props;

    return (
      <p>
        playing {props.media.title} from {String(props.startSeconds)}
      </p>
    );
  },
}));

const ARRIVAL = {
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Arrival',
  year: 2016,
  durationSeconds: 6960,
  width: 3840,
  height: 2160,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: null,
};

const known = new Map([[ARRIVAL.id, ARRIVAL]]);

beforeEach(() => {
  drawn.player = null;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.history.replaceState(null, '', `/watch/${ARRIVAL.id}`);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WatchPage', () => {
  it('holds the wordmark up until it knows what it is playing', () => {
    renderInAShell(<WatchPage />, { title: 'Living Room' });

    expect(screen.getByRole('status', { name: 'Loading Living Room' })).toBeInTheDocument();
  });

  it('starts where the server says this viewer got to', () => {
    renderInAShell(<WatchPage />, {
      known,
      progress: new Map([
        [
          ARRIVAL.id,
          {
            mediaId: ARRIVAL.id,
            positionSeconds: 1800.6,
            durationSeconds: 6960,
            isFinished: false,
            updatedAt: '2026-08-10T00:00:00.000Z',
          },
        ],
      ]),
    });

    expect(screen.getByText('playing Arrival from 1800')).toBeInTheDocument();
  });

  it('starts where it was told to instead, when something asked for a position', () => {
    renderInAShell(<WatchPage />, {
      known,
      startOverride: { mediaId: ARRIVAL.id, seconds: 42 },
    });

    expect(screen.getByText('playing Arrival from 42')).toBeInTheDocument();
  });

  it('starts a finished thing again rather than at its credits', () => {
    renderInAShell(<WatchPage />, {
      known,
      progress: new Map([
        [
          ARRIVAL.id,
          {
            mediaId: ARRIVAL.id,
            positionSeconds: 6950,
            durationSeconds: 6960,
            isFinished: true,
            updatedAt: '2026-08-10T00:00:00.000Z',
          },
        ],
      ]),
    });

    expect(screen.getByText('playing Arrival from 0')).toBeInTheDocument();
  });

  it('waits for the room before starting, where the address invited it to one', () => {
    window.history.replaceState(null, '', `/watch/${ARRIVAL.id}?party=party-1`);

    renderInAShell(<WatchPage />, { known });

    expect(screen.getByRole('status', { name: 'Joining the watch party' })).toBeInTheDocument();
  });

  it('gives up waiting for a room that never answers, rather than holding the screen', () => {
    window.history.replaceState(null, '', `/watch/${ARRIVAL.id}?party=party-1`);

    renderInAShell(<WatchPage />, { known });

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByText('playing Arrival from 0')).toBeInTheDocument();
  });

  it('asks to join the party the address named', () => {
    window.history.replaceState(null, '', `/watch/${ARRIVAL.id}?party=party-1`);

    const join = vi.fn();
    const shell = aShell({ known });

    renderInAShell(<WatchPage />, { known, watchParty: { ...shell.watchParty, join } });

    expect(join).toHaveBeenCalledWith('party-1');
  });

  it('reports where it has got to, but not on every tick', () => {
    const reportProgress = vi.fn();

    renderInAShell(<WatchPage />, { known, reportProgress });

    act(() => {
      drawn.player?.onProgress?.(1, 6960);
      drawn.player?.onProgress?.(2, 6960);
    });

    expect(reportProgress).not.toHaveBeenCalled();

    act(() => {
      drawn.player?.onProgress?.(30, 6960);
    });

    expect(reportProgress).toHaveBeenCalledWith(
      expect.objectContaining({ mediaId: ARRIVAL.id, positionSeconds: 30 }),
    );
  });

  it('goes back to what it was playing when the player is closed', async () => {
    renderInAShell(<WatchPage />, { known });

    act(() => {
      drawn.player?.onClose?.();
    });

    await vi.waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });

    expect(window.location.search).toContain(`item=${ARRIVAL.id}`);
  });
});
