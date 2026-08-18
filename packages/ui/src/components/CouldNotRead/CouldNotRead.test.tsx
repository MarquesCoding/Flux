import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CouldNotRead } from './CouldNotRead';

describe('CouldNotRead', () => {
  it('names what could not be read, since a page reads several things', () => {
    render(<CouldNotRead what="Your library" onTryAgain={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Your library could not be read');
  });

  it('announces itself, so somebody who cannot see it is told too', () => {
    render(<CouldNotRead what="Your library" onTryAgain={vi.fn()} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('offers to try again, since most of what puts a panel here passes', async () => {
    const tryAgain = vi.fn();
    const user = userEvent.setup();
    render(<CouldNotRead what="Your library" onTryAgain={tryAgain} />);

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(tryAgain).toHaveBeenCalledOnce();
  });

  it('says the reading is happening on the button rather than replacing the panel', () => {
    render(<CouldNotRead what="Your library" onTryAgain={vi.fn()} isTryingAgain />);

    expect(screen.getByRole('alert')).toHaveTextContent('could not be read');
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('offers a way out rather than only a fault, which is the whole point of it', () => {
    render(<CouldNotRead what="The accounts" onTryAgain={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(CouldNotRead.displayName).toBe('CouldNotRead');
  });
});
