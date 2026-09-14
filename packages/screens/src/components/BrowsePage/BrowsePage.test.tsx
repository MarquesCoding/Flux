import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAShell } from '@ValenceScreens/testing/renderInAShell';
import { BrowsePage } from './BrowsePage';
import type { BrowseAreaProps } from '@ValenceScreens/components/BrowseArea/BrowseArea.types';

const drawn = vi.hoisted((): { props: BrowseAreaProps | null } => ({ props: null }));

const mayAdminister = vi.hoisted(() => vi.fn<() => boolean>());

vi.mock('@ValenceClient/session/useWhatIMayDo', () => ({
  useWhatIMayDo: () => ({ may: () => false, mayAdminister: mayAdminister() }),
}));

const TED = {
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Ted Lasso',
  year: 2020,
  durationSeconds: 1800,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: null,
  seriesTitle: 'Ted Lasso',
};

vi.mock('@ValenceScreens/components/BrowseArea/BrowseArea', () => ({
  BrowseArea: (props: BrowseAreaProps) => {
    drawn.props = props;

    return (
      <div>
        <button
          type="button"
          onClick={() => {
            props.onPlay?.(TED, 90);
          }}
        >
          Play Ted
        </button>

        <button
          type="button"
          onClick={() => {
            props.onOpenShow?.(TED);
          }}
        >
          Open the programme
        </button>
      </div>
    );
  },
}));

beforeEach(() => {
  drawn.props = null;
  mayAdminister.mockReset().mockReturnValue(false);
  window.history.replaceState(null, '', '/films');
});

describe('BrowsePage', () => {
  it('draws the page the address names', () => {
    renderInAShell(<BrowsePage />);

    expect(drawn.props?.kind).toBe('films');
  });

  it('draws the programmes page, and the newest, and what is kept', () => {
    for (const section of ['shows', 'new', 'favourites']) {
      window.history.replaceState(null, '', `/${section}`);

      renderInAShell(<BrowsePage />);

      expect(drawn.props?.kind).toBe(section);
    }
  });

  it('says how far through each thing this viewer is', () => {
    renderInAShell(<BrowsePage />, {
      progress: new Map([
        [
          TED.id,
          {
            mediaId: TED.id,
            positionSeconds: 900,
            durationSeconds: 1800,
            isFinished: false,
            updatedAt: '2026-08-10T00:00:00.000Z',
          },
        ],
      ]),
    });

    expect(drawn.props?.watchedFractionFor?.(TED.id)).toBeCloseTo(0.5);
    expect(drawn.props?.resumeFor?.(TED.id)).toBe(900);
  });

  it('starts something where it was asked to start', async () => {
    const setStartOverride = vi.fn();
    const actor = userEvent.setup();

    renderInAShell(<BrowsePage />, { setStartOverride });

    await actor.click(screen.getByRole('button', { name: 'Play Ted' }));

    expect(setStartOverride).toHaveBeenCalledWith({ mediaId: TED.id, seconds: 90 });
    expect(window.location.pathname).toBe(`/watch/${TED.id}`);
  });

  it('opens the programme an episode belongs to rather than the episode', async () => {
    const actor = userEvent.setup();

    renderInAShell(<BrowsePage />);

    await actor.click(screen.getByRole('button', { name: 'Open the programme' }));

    expect(window.location.search).toContain('show=ted-lasso');
  });

  it('offers somewhere to add a library to anybody who may administer the server', () => {
    mayAdminister.mockReturnValue(true);

    renderInAShell(<BrowsePage />);

    expect(drawn.props?.onAddLibrary).toBeDefined();
  });

  it('offers that to nobody who could not act on it, nor before the server has said', () => {
    renderInAShell(<BrowsePage />);

    expect(drawn.props?.onAddLibrary).toBeUndefined();
  });
});
