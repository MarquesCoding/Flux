import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatStrip } from './StatStrip';

/**
 * How far the bar beside a figure is filled.
 */
const barWidth = (container: HTMLElement): string | null => {
  const bar = container.querySelector('[role="presentation"]');

  return bar instanceof HTMLElement ? bar.style.width : null;
};

describe('StatStrip', () => {
  it('names each figure', () => {
    render(<StatStrip stats={[{ label: 'Items', value: '15' }]} />);

    expect(screen.getByText('Items')).toBeInTheDocument();
  });

  it('says each figure', () => {
    render(<StatStrip stats={[{ label: 'Items', value: '15' }]} />);

    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('reads as one instrument rather than four unrelated facts', () => {
    const { container } = render(
      <StatStrip
        stats={[
          { label: 'Items', value: '15' },
          { label: 'Libraries', value: '2' },
        ]}
      />,
    );

    expect(container.querySelectorAll('dl')).toHaveLength(1);
    expect(screen.getAllByRole('term')).toHaveLength(2);
  });

  it('draws a bar for a figure that is part of something larger', () => {
    const { container } = render(
      <StatStrip
        stats={[
          {
            label: 'Memory',
            value: '8 GB',
            fraction: 0.5,
          },
        ]}
      />,
    );

    expect(barWidth(container)).toBe('50%');
  });

  it('draws no bar for a figure that is only a number', () => {
    const { container } = render(<StatStrip stats={[{ label: 'Items', value: '15' }]} />);

    expect(barWidth(container)).toBeNull();
  });

  it('never draws a bar past full', () => {
    const { container } = render(
      <StatStrip
        stats={[
          {
            label: 'CPU',
            value: '140%',
            fraction: 1.4,
          },
        ]}
      />,
    );

    expect(barWidth(container)).toBe('100%');
  });

  it('adds a note where a figure needs one', () => {
    render(
      <StatStrip
        stats={[
          {
            label: 'Items',
            value: '15',
            detail: 'across 2 libraries',
          },
        ]}
      />,
    );

    expect(screen.getByText('across 2 libraries')).toBeInTheDocument();
  });

  it('shows nothing at all before there is anything to show', () => {
    render(<StatStrip stats={[]} />);

    expect(screen.queryAllByRole('term')).toHaveLength(0);
  });
});
