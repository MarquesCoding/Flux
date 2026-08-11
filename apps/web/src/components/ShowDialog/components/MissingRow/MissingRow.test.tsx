import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MissingRow } from './MissingRow';

describe('MissingRow', () => {
  it('says which episode is not here', () => {
    render(<MissingRow episodeNumber={3} />);

    expect(screen.getByText('Episode 3')).toBeInTheDocument();
  });

  it('says why the row is empty rather than leaving a blank', () => {
    render(<MissingRow episodeNumber={3} />);

    expect(screen.getByText('Not in this library')).toBeInTheDocument();
  });

  it('offers nothing to press, since there is nothing to play', () => {
    render(<MissingRow episodeNumber={3} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps its number in the column the real rows use', () => {
    render(<MissingRow episodeNumber={12} />);

    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(MissingRow.displayName).toBe('MissingRow');
  });
});
