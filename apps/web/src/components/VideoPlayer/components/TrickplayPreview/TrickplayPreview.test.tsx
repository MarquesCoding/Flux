import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrickplayPreview } from './TrickplayPreview';
import type { Trickplay } from '@FluxWeb/playback/fetchTrickplay';

const trickplay: Trickplay = {
  width: 320,
  height: 180,
  thumbnails: [
    {
      startSeconds: 0,
      endSeconds: 10,
      sheetUrl: 'http://localhost/sheet-001.jpg',
      x: 0,
      y: 0,
      width: 320,
      height: 180,
    },
    {
      startSeconds: 10,
      endSeconds: 20,
      sheetUrl: 'http://localhost/sheet-001.jpg',
      x: 320,
      y: 0,
      width: 320,
      height: 180,
    },
  ],
};

describe('TrickplayPreview', () => {
  it('shows the moment being hovered', () => {
    render(<TrickplayPreview trickplay={trickplay} seconds={12} />);

    expect(screen.getByText('0:12')).toBeInTheDocument();
  });

  it('offsets the sheet to the frame covering that moment', () => {
    render(<TrickplayPreview trickplay={trickplay} seconds={12} />);

    expect(screen.getByRole('img', { name: 'Preview at 0:12' })).toHaveStyle({
      backgroundPosition: '-320px -0px',
    });
  });

  it('draws nothing when there are no thumbnails', () => {
    render(<TrickplayPreview trickplay={{ ...trickplay, thumbnails: [] }} seconds={12} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
