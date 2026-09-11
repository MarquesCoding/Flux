import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedRow } from './SegmentedRow';

const ITEMS = [
  { id: 'books', label: 'Books' },
  { id: 'shows', label: 'Shows' },
  { id: 'storage', label: 'Storage' },
] as const;

describe('SegmentedRow', () => {
  it('offers every choice it was given', () => {
    render(<SegmentedRow label="Which library" items={ITEMS} value="books" onSelect={() => {}} />);

    for (const item of ITEMS) {
      expect(screen.getByRole('button', { name: item.label })).toBeInTheDocument();
    }
  });

  it('says which one is chosen rather than only drawing it', () => {
    render(<SegmentedRow label="Which library" items={ITEMS} value="shows" onSelect={() => {}} />);

    expect(screen.getByRole('button', { name: 'Shows' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Books' })).not.toHaveAttribute('aria-pressed');
  });

  it('says what the choice is about, for anybody who cannot see the track', () => {
    render(<SegmentedRow label="Which library" items={ITEMS} value="books" onSelect={() => {}} />);

    expect(screen.getByRole('group', { name: 'Which library' })).toBeInTheDocument();
  });

  it('tells the caller which one was pressed', async () => {
    const chose = vi.fn();

    render(<SegmentedRow label="Which library" items={ITEMS} value="books" onSelect={chose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Storage' }));

    expect(chose).toHaveBeenCalledWith('storage');
  });

  it('is one track rather than a row of separate pills', () => {
    render(<SegmentedRow label="Which library" items={ITEMS} value="books" onSelect={() => {}} />);

    expect(screen.getByRole('group', { name: 'Which library' })).toHaveClass(
      'bg-[var(--surface-hover)]',
    );
  });

  it('carries one mark, which is what lets it travel between the choices', () => {
    render(<SegmentedRow label="Which library" items={ITEMS} value="books" onSelect={() => {}} />);

    expect(document.querySelectorAll('[data-mark="segmented-Which library"]')).toHaveLength(1);
  });

  it('draws a choice with nothing behind it fainter, rather than in a dashed outline', () => {
    render(
      <SegmentedRow
        label="Which season"
        items={[
          { id: 's1', label: 'Season 1' },
          { id: 's2', label: 'Season 2', isAbsent: true },
        ]}
        value="s1"
        onSelect={() => {}}
      />,
    );

    const missing = screen.getByRole('button', { name: 'Season 2' });

    expect(missing).toHaveClass('text-text-muted/60');
    expect(missing.className).not.toContain('border-dashed');
  });

  it('draws that choice in full once it is the one chosen', () => {
    render(
      <SegmentedRow
        label="Which season"
        items={[
          { id: 's1', label: 'Season 1' },
          { id: 's2', label: 'Season 2', isAbsent: true },
        ]}
        value="s2"
        onSelect={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Season 2' })).not.toHaveClass('text-text-muted/60');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SegmentedRow.displayName).toBe('SegmentedRow');
  });
});

describe('the size of a SegmentedRow', () => {
  it('stands at the height of a control by default', () => {
    render(<SegmentedRow label="Which library" items={ITEMS} value="books" onSelect={() => {}} />);

    expect(screen.getByRole('button', { name: 'Books' })).toHaveClass('h-9');
  });

  it('stands shorter where it sits inside a page rather than at the head of one', () => {
    render(
      <SegmentedRow
        label="Which library"
        items={ITEMS}
        value="books"
        onSelect={() => {}}
        size="sm"
      />,
    );

    expect(screen.getByRole('button', { name: 'Books' })).toHaveClass('h-[26px]');
  });
});

it('keeps the chosen label readable under a pointer, where the mark behind it is light', () => {
  render(<SegmentedRow label="Which library" items={ITEMS} value="books" onSelect={() => {}} />);

  expect(screen.getByRole('button', { name: 'Books' })).toHaveClass('hover:text-surface');
});
