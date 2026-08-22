import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { WindowBar } from './WindowBar';

const bar = (given: Partial<Parameters<typeof WindowBar>[0]> = {}) =>
  render(
    <WindowBar
      name="Valence"
      canGoBack={true}
      canGoForward={true}
      onBack={vi.fn()}
      onForward={vi.fn()}
      {...given}
    />,
  );

describe('WindowBar', () => {
  it('says what the application is called, and leaves what is playing to the screen', () => {
    bar();

    expect(screen.getByText('Valence')).toBeInTheDocument();
    expect(screen.queryByText(/Watching/)).not.toBeInTheDocument();
  });

  it('goes back when asked', async () => {
    const onBack = vi.fn();

    bar({ onBack });

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalled();
  });

  it('goes forward when asked', async () => {
    const onForward = vi.fn();

    bar({ onForward });

    await userEvent.click(screen.getByRole('button', { name: 'Forward' }));

    expect(onForward).toHaveBeenCalled();
  });

  it('offers no way back when there is nowhere behind us', () => {
    bar({ canGoBack: false });

    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('offers no way forward when there is nowhere ahead of us', () => {
    bar({ canGoForward: false });

    expect(screen.getByRole('button', { name: 'Forward' })).toBeDisabled();
  });
});
