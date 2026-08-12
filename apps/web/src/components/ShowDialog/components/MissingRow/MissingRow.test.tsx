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

  it('calls the episode what the catalogue calls it, when it said', () => {
    render(<MissingRow episodeNumber={3} title="Someone Is Thinking of Someone" />);

    expect(screen.getByText('Someone Is Thinking of Someone')).toBeInTheDocument();
  });

  it('falls back to the number when nothing named it', () => {
    render(<MissingRow episodeNumber={3} />);

    expect(screen.getByText('Episode 3')).toBeInTheDocument();
  });

  it("shows the catalogue's still, so the gap is a picture rather than a blank", () => {
    render(
      <MissingRow episodeNumber={3} title="An episode" stillUrl="https://example.com/a.jpg" />,
    );

    expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
      'src',
      'https://example.com/a.jpg',
    );
  });

  it('draws no picture when the catalogue had none', () => {
    const { container } = render(<MissingRow episodeNumber={3} title="An episode" />);

    expect(container.querySelector('img')).toBeNull();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(MissingRow.displayName).toBe('MissingRow');
  });
});
