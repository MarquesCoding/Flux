import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAShell } from '@FluxScreens/testing/renderInAShell';
import { SearchPage } from './SearchPage';
import type { SearchAreaProps } from '@FluxScreens/components/SearchArea/SearchArea.types';

const drawn = vi.hoisted((): { props: SearchAreaProps | null } => ({ props: null }));

vi.mock('@FluxScreens/components/SearchArea/SearchArea', () => ({
  SearchArea: (props: SearchAreaProps) => {
    drawn.props = props;

    return <p>searching</p>;
  },
}));

beforeEach(() => {
  drawn.props = null;
  window.history.replaceState(null, '', '/search');
});

describe('SearchPage', () => {
  it('searches for what the address says', () => {
    window.history.replaceState(null, '', '/search?q=blade&genre=drama');

    renderInAShell(<SearchPage />);

    expect(drawn.props?.search).toBe('blade');
    expect(drawn.props?.genre).toBe('drama');
  });

  it('puts what was typed in the address without leaving a history behind', async () => {
    renderInAShell(<SearchPage />);

    drawn.props?.onSearchChange?.('dune');

    await vi.waitFor(() => {
      expect(window.location.search).toContain('q=dune');
    });
  });

  it('puts a chosen genre in the address', async () => {
    renderInAShell(<SearchPage />);

    drawn.props?.onGenreChange?.('thriller');

    await vi.waitFor(() => {
      expect(window.location.search).toContain('genre=thriller');
    });
  });

  it('says how far through each result this viewer is', () => {
    renderInAShell(<SearchPage />, {
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
});
