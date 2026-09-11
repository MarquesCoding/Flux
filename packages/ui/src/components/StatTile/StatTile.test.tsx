import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatTile } from './StatTile';

/**
 * Draws a tile inside the list it belongs to, since a term and its description only mean anything
 * inside one.
 *
 * @param tile - The tile.
 * @returns What was rendered.
 */
const inList = (tile: React.ReactNode) => render(<dl>{tile}</dl>);

describe('StatTile', () => {
  it('says what the figure is, and then the figure', () => {
    inList(<StatTile label="Memory" value="30 GB" />);

    expect(screen.getByRole('term')).toHaveTextContent('Memory');
    expect(screen.getByRole('definition')).toHaveTextContent('30 GB');
  });

  it('carries the label in a tinted shell and the figure on a face set into it', () => {
    inList(<StatTile label="Memory" value="30 GB" />);

    expect(screen.getByRole('term').parentElement).toHaveClass('valence-card-shell');
    expect(screen.getByRole('definition')).toHaveClass('valence-card-face');
  });

  it('qualifies the figure where it is given a line to do it with', () => {
    inList(<StatTile label="Memory" value="30 GB" detail="of 48 GB" />);

    expect(screen.getByText('of 48 GB')).toBeInTheDocument();
  });

  it('draws how full it is, where the figure is part of a fixed whole', () => {
    const { container } = inList(<StatTile label="Storage" value="109 GB free" fraction={0.25} />);

    expect(container.querySelector('[role="presentation"]')).toHaveStyle({ width: '25%' });
  });

  it('never draws a bar fuller than full or emptier than empty', () => {
    const { container: over } = inList(<StatTile label="CPU" value="140%" fraction={1.4} />);
    const { container: under } = inList(<StatTile label="CPU" value="0%" fraction={-0.2} />);

    expect(over.querySelector('[role="presentation"]')).toHaveStyle({ width: '100%' });
    expect(under.querySelector('[role="presentation"]')).toHaveStyle({ width: '0%' });
  });

  it('draws no bar at all for a figure that is not part of anything', () => {
    const { container } = inList(<StatTile label="Library" value="144" />);

    expect(container.querySelector('[role="presentation"]')).toBeNull();
  });

  it('draws whatever it is given beside the label', () => {
    inList(<StatTile label="Memory" value="30 GB" icon={<span data-testid="chip" />} />);

    expect(screen.getByTestId('chip')).toBeInTheDocument();
  });

  it('keeps a history behind the figure rather than in front of it', () => {
    inList(<StatTile label="CPU" value="9%" history={<span data-testid="line" />} />);

    expect(screen.getByTestId('line').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(StatTile.displayName).toBe('StatTile');
  });
});
