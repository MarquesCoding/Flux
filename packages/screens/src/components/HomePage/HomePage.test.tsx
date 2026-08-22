import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAShell } from '@ValenceScreens/testing/renderInAShell';
import { HomePage } from './HomePage';
import type { LibraryBrowserProps } from '@ValenceScreens/components/LibraryBrowser/LibraryBrowser.types';

const drawn = vi.hoisted((): { props: LibraryBrowserProps | null } => ({ props: null }));

vi.mock('@ValenceScreens/components/LibraryBrowser/LibraryBrowser', () => ({
  LibraryBrowser: (props: LibraryBrowserProps) => {
    drawn.props = props;

    return (
      <button
        type="button"
        onClick={() => {
          props.onWatch?.(ARRIVAL, 1800);
        }}
      >
        Watch Arrival
      </button>
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

beforeEach(() => {
  drawn.props = null;
  window.history.replaceState(null, '', '/');
});

describe('HomePage', () => {
  it('opens with a hero, and calls the instance what it is called', () => {
    renderInAShell(<HomePage />, { title: 'Living Room' });

    expect(drawn.props?.hasHero).toBe(true);
    expect(drawn.props?.name).toBe('Living Room');
  });

  it('lights the page from what the hero is showing', () => {
    const setMoodLights = vi.fn();

    renderInAShell(<HomePage />, { setMoodLights });

    drawn.props?.onPalette?.([{ color: 'rgb(1 2 3)' }]);

    expect(setMoodLights).toHaveBeenCalled();
  });

  it('remembers where something was started from, so the player picks it up there', async () => {
    const setStartOverride = vi.fn();
    const actor = userEvent.setup();

    renderInAShell(<HomePage />, { setStartOverride });

    await actor.click(screen.getByRole('button', { name: 'Watch Arrival' }));

    expect(setStartOverride).toHaveBeenCalledWith({ mediaId: ARRIVAL.id, seconds: 1800 });
    expect(window.location.pathname).toBe(`/watch/${ARRIVAL.id}`);
  });

  it('tells the shell what it drew, so an address naming an item can be resolved', () => {
    const rememberItems = vi.fn();

    renderInAShell(<HomePage />, { rememberItems });

    drawn.props?.onItemsLoaded?.([ARRIVAL]);

    expect(rememberItems).toHaveBeenCalledWith([ARRIVAL]);
  });
});
