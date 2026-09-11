import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GridSizeChooser } from './GridSizeChooser';

describe('GridSizeChooser', () => {
  it('says what the row of controls is for', () => {
    render(<GridSizeChooser value="medium" onValueChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'How large the cards are' })).toBeInTheDocument();
  });

  it('offers every size, named by what it does rather than by its glyph alone', () => {
    render(<GridSizeChooser value="medium" onValueChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Small cards, more of them' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium cards' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Large cards, fewer of them' })).toBeInTheDocument();
  });

  it('changes the size when one is pressed', async () => {
    const onValueChange = vi.fn<(size: string) => void>();
    const user = userEvent.setup();

    render(<GridSizeChooser value="medium" onValueChange={onValueChange} />);

    await user.click(screen.getByRole('button', { name: 'Large cards, fewer of them' }));

    expect(onValueChange).toHaveBeenCalledWith('large');
  });

  it('says which size is in force rather than only drawing it differently', () => {
    render(<GridSizeChooser value="small" onValueChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Small cards, more of them' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('rests its mark on the size in force', () => {
    render(<GridSizeChooser value="small" onValueChange={vi.fn()} />);

    const marks = document.querySelectorAll('[data-mark]');

    expect(marks).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Small cards, more of them' })).toContainElement(
      marks[0] instanceof HTMLElement ? marks[0] : null,
    );
  });

  it('moves the one mark to whatever the pointer passes over', async () => {
    const user = userEvent.setup();

    render(<GridSizeChooser value="small" onValueChange={vi.fn()} />);

    await user.hover(screen.getByRole('button', { name: 'Large cards, fewer of them' }));

    const marks = document.querySelectorAll('[data-mark]');

    expect(marks).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Large cards, fewer of them' })).toContainElement(
      marks[0] instanceof HTMLElement ? marks[0] : null,
    );
  });

  it('gives the mark back to the size in force when the pointer leaves', async () => {
    const user = userEvent.setup();

    render(<GridSizeChooser value="small" onValueChange={vi.fn()} />);

    await user.hover(screen.getByRole('button', { name: 'Large cards, fewer of them' }));
    await user.unhover(screen.getByRole('button', { name: 'Large cards, fewer of them' }));

    const marks = document.querySelectorAll('[data-mark]');

    expect(screen.getByRole('button', { name: 'Small cards, more of them' })).toContainElement(
      marks[0] instanceof HTMLElement ? marks[0] : null,
    );
  });

  it('sets a display name so devtools can identify it', () => {
    expect(GridSizeChooser.displayName).toBe('GridSizeChooser');
  });
});

describe('how the sizes are drawn', () => {
  it('draws each size with its own glyph, from many small squares to one large one', () => {
    render(<GridSizeChooser value="medium" onValueChange={vi.fn()} />);

    const drawn = ['Small cards, more of them', 'Medium cards', 'Large cards, fewer of them'].map(
      (name) => screen.getByRole('button', { name }).querySelector('svg')?.innerHTML ?? '',
    );

    expect(drawn.every((glyph) => glyph !== '')).toBe(true);
    expect(new Set(drawn).size).toBe(3);
  });

  it('sits in the flat track the other segmented controls use, rather than in glass', () => {
    render(<GridSizeChooser value="medium" onValueChange={vi.fn()} />);

    const track = screen.getByRole('group', { name: 'How large the cards are' });

    expect(track).toHaveClass('bg-[var(--surface-hover)]');
    expect(track).not.toHaveClass('valence-glass');
  });
});
