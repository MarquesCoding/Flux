import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInACache } from '@FluxWeb/testing/renderInACache';
import { SharePage } from './SharePage';
import type { ShareAreaProps } from '@FluxWeb/components/ShareArea/ShareArea.types';
import type { VideoPlayerProps } from '@FluxWeb/components/VideoPlayer/VideoPlayer.types';

const drawn = vi.hoisted((): { share: ShareAreaProps | null; player: VideoPlayerProps | null } => ({
  share: null,
  player: null,
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

vi.mock('@FluxWeb/components/ShareArea/ShareArea', () => ({
  ShareArea: (props: ShareAreaProps) => {
    drawn.share = props;

    return (
      <button
        type="button"
        onClick={() => {
          props.onPlay(ARRIVAL, 0);
        }}
      >
        Play it
      </button>
    );
  },
}));

vi.mock('@FluxWeb/components/VideoPlayer/VideoPlayer', () => ({
  VideoPlayer: (props: VideoPlayerProps) => {
    drawn.player = props;

    return (
      <div>
        <p>playing {props.media.title}</p>

        <button
          type="button"
          onClick={() => {
            props.onProgress?.(120, 6960);
          }}
        >
          Watch a bit
        </button>

        <button type="button" onClick={props.onClose}>
          Stop
        </button>
      </div>
    );
  },
}));

beforeEach(() => {
  drawn.share = null;
  drawn.player = null;
  window.history.replaceState(null, '', '/share/a-token');
});

describe('SharePage', () => {
  it('opens what the link in the address points at', () => {
    renderInACache(<SharePage name="Flux" />);

    expect(drawn.share?.token).toBe('a-token');
  });

  it('plays what the guest chose', async () => {
    const actor = userEvent.setup();

    renderInACache(<SharePage name="Flux" />);

    await actor.click(screen.getByRole('button', { name: 'Play it' }));

    expect(screen.getByText('playing Arrival')).toBeInTheDocument();
  });

  it('picks up where a guest got to, for as long as the page lives', async () => {
    const actor = userEvent.setup();

    renderInACache(<SharePage name="Flux" />);

    await actor.click(screen.getByRole('button', { name: 'Play it' }));
    await actor.click(screen.getByRole('button', { name: 'Watch a bit' }));
    await actor.click(screen.getByRole('button', { name: 'Stop' }));

    expect(drawn.share?.resumeFor?.(ARRIVAL.id)).toBe(120);
  });

  it('has nowhere else to go, since a guest is not signed in', () => {
    renderInACache(<SharePage name="The Attic" />);

    expect(drawn.share?.name).toBe('The Attic');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
