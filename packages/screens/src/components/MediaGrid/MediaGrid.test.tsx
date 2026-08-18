import { screen } from '@testing-library/react';
import { renderInAnAddress } from '@FluxScreens/testing/renderInAnAddress';
import { describe, expect, it, vi } from 'vitest';
import { MediaGrid } from './MediaGrid';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const item = (id: string, title: string): MediaSummary => ({
  id,
  libraryId: 'library-1',
  title,
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
  hasLogo: false,
  seriesId: null,
});

const items = [item('a', 'Arrival'), item('b', 'Dune')];

describe('MediaGrid', () => {
  it('draws every item it is given', () => {
    renderInAnAddress(<MediaGrid items={items} onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Arrival/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
  });

  it('draws nothing at all when there is nothing to draw', () => {
    renderInAnAddress(<MediaGrid items={[]} onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says how far through each item this viewer is', () => {
    const { container } = renderInAnAddress(
      <MediaGrid
        items={items}
        onPlay={vi.fn()}
        onInspect={vi.fn()}
        watchedFractionFor={(mediaId) => (mediaId === 'a' ? 0.5 : undefined)}
      />,
    );

    expect(container.querySelector('[style*="50%"]')).not.toBeNull();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(MediaGrid.displayName).toBe('MediaGrid');
  });

  it('lays the cards out at the size it is given', () => {
    const { container } = renderInAnAddress(
      <MediaGrid items={items} size="small" onPlay={vi.fn()} onInspect={vi.fn()} />,
    );

    expect(container.querySelector('ul')).toHaveClass('xl:grid-cols-6');
  });

  it('settles on the middle size when nobody has chosen one', () => {
    const { container } = renderInAnAddress(
      <MediaGrid items={items} onPlay={vi.fn()} onInspect={vi.fn()} />,
    );

    expect(container.querySelector('ul')).toHaveClass('xl:grid-cols-4');
  });

  it('shows fewer, larger cards when asked for large ones', () => {
    const { container } = renderInAnAddress(
      <MediaGrid items={items} size="large" onPlay={vi.fn()} onInspect={vi.fn()} />,
    );

    expect(container.querySelector('ul')).toHaveClass('xl:grid-cols-3');
  });
});
