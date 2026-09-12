import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { shareEndingFor } from '@ValenceClient/sharing/shareEndingFor';
import { SharePage } from './SharePage';
import type { ShareAreaProps } from '@ValenceScreens/components/ShareArea/ShareArea.types';
import type { VideoPlayerProps } from '@ValenceScreens/components/VideoPlayer/VideoPlayer.types';

vi.mock('@ValenceClient/sharing/shareEndingFor', () => ({
  shareEndingFor: vi.fn(),
}));

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

vi.mock('@ValenceScreens/components/ShareArea/ShareArea', () => ({
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

vi.mock('@ValenceScreens/components/VideoPlayer/VideoPlayer', () => ({
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
  vi.clearAllMocks();

  drawn.share = null;
  drawn.player = null;
  window.history.replaceState(null, '', '/share/a-token');
});

describe('SharePage', () => {
  it('opens what the link in the address points at', () => {
    renderInAnAddress(<SharePage name="Valence" />);

    expect(drawn.share?.token).toBe('a-token');
  });

  it('plays what the guest chose', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<SharePage name="Valence" />);

    await actor.click(screen.getByRole('button', { name: 'Play it' }));

    expect(screen.getByText('playing Arrival')).toBeInTheDocument();
  });

  it('picks up where a guest got to, for as long as the page lives', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<SharePage name="Valence" />);

    await actor.click(screen.getByRole('button', { name: 'Play it' }));
    await actor.click(screen.getByRole('button', { name: 'Watch a bit' }));
    await actor.click(screen.getByRole('button', { name: 'Stop' }));

    expect(drawn.share?.resumeFor?.(ARRIVAL.id)).toBe(120);
  });

  it('takes the picture away as soon as the link stops working', async () => {
    vi.mocked(shareEndingFor).mockResolvedValue(null);

    const user = userEvent.setup();

    renderInAnAddress(<SharePage name="Valence" askEveryMilliseconds={5} />);

    await user.click(screen.getByRole('button', { name: 'Play it' }));

    expect(await screen.findByText('playing Arrival')).toBeInTheDocument();

    vi.mocked(shareEndingFor).mockResolvedValue('withdrawn');

    await waitFor(() => {
      expect(screen.queryByText('playing Arrival')).not.toBeInTheDocument();
    });

    expect(shareEndingFor).toHaveBeenCalledWith('a-token');
    expect(drawn.share?.ended).toBe('withdrawn');
  });

  it('asks nothing while nothing is playing, since the screen asks for itself', async () => {
    vi.mocked(shareEndingFor).mockResolvedValue('withdrawn');

    renderInAnAddress(<SharePage name="Valence" askEveryMilliseconds={5} />);

    await new Promise((settle) => setTimeout(settle, 30));

    expect(shareEndingFor).not.toHaveBeenCalled();
  });

  it('leaves a working link alone', async () => {
    vi.mocked(shareEndingFor).mockResolvedValue(null);

    const user = userEvent.setup();

    renderInAnAddress(<SharePage name="Valence" askEveryMilliseconds={5} />);

    await user.click(screen.getByRole('button', { name: 'Play it' }));
    await waitFor(() => {
      expect(shareEndingFor).toHaveBeenCalled();
    });

    expect(screen.getByText('playing Arrival')).toBeInTheDocument();
  });

  it('puts a guest back on the screen that explains itself once they close the notice', async () => {
    const user = userEvent.setup();

    renderInAnAddress(<SharePage name="Valence" />);

    await user.click(screen.getByRole('button', { name: 'Play it' }));
    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(screen.getByRole('button', { name: 'Play it' })).toBeInTheDocument();
  });

  it('has nothing to resume before anything has been watched', () => {
    renderInAnAddress(<SharePage name="Valence" />);

    expect(drawn.share?.resumeFor?.(ARRIVAL.id)).toBeNull();
  });

  it('has nowhere else to go, since a guest is not signed in', () => {
    renderInAnAddress(<SharePage name="The Attic" />);

    expect(drawn.share?.name).toBe('The Attic');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
