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

  it('sets a display name so devtools can identify it', () => {
    expect(GridSizeChooser.displayName).toBe('GridSizeChooser');
  });
});
