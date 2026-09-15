import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAShell } from '@ValenceScreens/testing/renderInAShell';
import { SearchDrawer } from './SearchDrawer';
import type { SearchAreaProps } from '@ValenceScreens/components/SearchArea/SearchArea.types';

const drawn = vi.hoisted((): { props: SearchAreaProps | null } => ({ props: null }));

vi.mock('@ValenceScreens/components/SearchArea/SearchArea', () => ({
  SearchArea: (props: SearchAreaProps) => {
    drawn.props = props;

    return <p>searching</p>;
  },
}));

beforeEach(() => {
  drawn.props = null;
  window.history.replaceState(null, '', '/');
});

describe('SearchDrawer', () => {
  it('shows nothing while shut', () => {
    renderInAShell(<SearchDrawer isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByText('searching')).not.toBeInTheDocument();
  });

  it('raises itself over the page rather than going to one of its own', () => {
    renderInAShell(<SearchDrawer isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
  });

  it('closes from its own button', async () => {
    const actor = userEvent.setup();
    const onClose = vi.fn();

    renderInAShell(<SearchDrawer isOpen onClose={onClose} />);

    await actor.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('searches for what the address says', () => {
    window.history.replaceState(null, '', '/?search=open&q=blade&genre=drama');

    renderInAShell(<SearchDrawer isOpen onClose={vi.fn()} />);

    expect(drawn.props?.search).toBe('blade');
    expect(drawn.props?.genre).toBe('drama');
  });

  it('puts what was typed in the address without leaving a history behind', async () => {
    renderInAShell(<SearchDrawer isOpen onClose={vi.fn()} />);

    drawn.props?.onSearchChange?.('dune');

    await vi.waitFor(() => {
      expect(window.location.search).toContain('q=dune');
    });
  });

  it('puts a chosen genre in the address', async () => {
    renderInAShell(<SearchDrawer isOpen onClose={vi.fn()} />);

    drawn.props?.onGenreChange?.('thriller');

    await vi.waitFor(() => {
      expect(window.location.search).toContain('genre=thriller');
    });
  });

  it('says how far through each result this viewer is', () => {
    renderInAShell(<SearchDrawer isOpen onClose={vi.fn()} />, {
      progress: new Map([
        [
          'media-1',
          {
            mediaId: 'media-1',
            positionSeconds: 300,
            durationSeconds: 600,
            isFinished: false,
            updatedAt: '2026-08-10T00:00:00.000Z',
          },
        ],
      ]),
    });

    expect(drawn.props?.watchedFractionFor?.('media-1')).toBeCloseTo(0.5);
    expect(drawn.props?.resumeFor?.('media-1')).toBe(300);
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SearchDrawer.displayName).toBe('SearchDrawer');
  });
});
