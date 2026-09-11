import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionBar } from './ActionBar';

const ACTIONS = [
  { id: 'share', label: 'Share', onChoose: vi.fn() },
  { id: 'party', label: 'Watch together', onChoose: vi.fn() },
];

describe('ActionBar', () => {
  it('keeps the action worth pressing in the bar', () => {
    render(<ActionBar label="More" primary={<span>Play</span>} actions={ACTIONS} />);

    expect(screen.getByText('Play')).toBeInTheDocument();
  });

  it('lays the rest out beside it, where there is room', () => {
    render(<ActionBar label="More" primary={<span>Play</span>} actions={ACTIONS} />);

    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Watch together' })).toBeInTheDocument();
  });

  it('does the thing an action is for when it is pressed', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();

    render(
      <ActionBar
        label="More"
        primary={<span>Play</span>}
        actions={[{ id: 'share', label: 'Share', onChoose }]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(onChoose).toHaveBeenCalledOnce();
  });

  it('draws the rest as flat secondary buttons, the same as every other', () => {
    render(<ActionBar label="More" primary={<span>Play</span>} actions={ACTIONS} />);

    expect(screen.getByRole('button', { name: 'Share' })).toHaveClass('bg-[var(--surface-hover)]');
  });

  it('folds them into a menu for a phone, named for anybody who cannot see the dots', () => {
    render(
      <ActionBar label="More to do with this" primary={<span>Play</span>} actions={ACTIONS} />,
    );

    expect(screen.getByRole('button', { name: 'More to do with this' })).toBeInTheDocument();
  });

  it('has no menu to fold anything into where there is nothing else to do', () => {
    render(<ActionBar label="More to do with this" primary={<span>Play</span>} actions={[]} />);

    expect(screen.queryByRole('button', { name: 'More to do with this' })).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(ActionBar.displayName).toBe('ActionBar');
  });
});
