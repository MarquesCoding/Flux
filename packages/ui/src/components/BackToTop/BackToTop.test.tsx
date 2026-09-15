import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackToTop } from './BackToTop';

/**
 * jsdom lays nothing out, so every element reports a top of zero and nothing has ever gone past the
 * top of the window. Saying where things sit is how the page is scrolled here.
 *
 * @param top - Where everything sits down the window.
 */
const everythingAt = (top: number) => {
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(0, top),
  });
};

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect');
  vi.unstubAllGlobals();
});

describe('BackToTop', () => {
  it('offers nothing while the top of the page is still in sight', () => {
    render(<BackToTop />);

    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument();
  });

  it('offers the way back once the top has gone', () => {
    everythingAt(-500);

    render(<BackToTop />);

    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument();
  });

  it('draws outside the page, so nothing moved can carry it up the screen', () => {
    everythingAt(-500);

    render(<BackToTop />);

    expect(screen.getByRole('button', { name: 'Back to top' }).parentElement?.parentElement).toBe(
      document.body,
    );
  });

  it('takes the page back to the top when it is pressed', async () => {
    const travelled = vi.fn();

    vi.stubGlobal('scrollTo', travelled);
    everythingAt(-500);

    const user = userEvent.setup();

    render(<BackToTop />);

    await user.click(screen.getByRole('button', { name: 'Back to top' }));

    expect(travelled).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it('answers to a name the caller gives it', () => {
    everythingAt(-500);

    render(<BackToTop label="Back to the start" />);

    expect(screen.getByRole('button', { name: 'Back to the start' })).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(BackToTop.displayName).toBe('BackToTop');
  });
});
