import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetPageCovers } from '@ValenceUI/pageCover';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogCompanion } from './DialogCompanion';

afterEach(() => {
  forgetPageCovers();
  vi.unstubAllGlobals();
});

/**
 * A window too narrow to stand two panels side by side, which jsdom has no opinion about on its own.
 */
const noRoomBeside = () => {
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches: false,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
};

describe('DialogCompanion', () => {
  it('is an ordinary dialog where there is nothing to stand beside', () => {
    render(
      <DialogCompanion label="Stream stats" isOpen onClose={vi.fn()}>
        <p>Nothing right now</p>
      </DialogCompanion>,
    );

    expect(screen.getByRole('dialog', { name: 'Stream stats' })).toBeInTheDocument();
    expect(screen.getByText('Nothing right now')).toBeInTheDocument();
  });

  it('shows nothing while it is shut', () => {
    render(
      <DialogCompanion label="Stream stats" isOpen={false} onClose={vi.fn()}>
        <p>Nothing right now</p>
      </DialogCompanion>,
    );

    expect(screen.queryByText('Nothing right now')).not.toBeInTheDocument();
  });

  it('stands beside the dialog it was opened from rather than over it', () => {
    render(
      <Dialog label="The server" isOpen onClose={vi.fn()}>
        <p>Accounts</p>

        <DialogCompanion label="What Sam may do" isOpen onClose={vi.fn()}>
          <p>Their roles decide everything</p>
        </DialogCompanion>
      </Dialog>,
    );

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    expect(screen.getByText('Their roles decide everything')).toBeInTheDocument();
  });

  it('draws into the column beside the panel, not inside it', () => {
    render(
      <Dialog label="The server" isOpen onClose={vi.fn()}>
        <p>Accounts</p>

        <DialogCompanion label="What Sam may do" isOpen onClose={vi.fn()}>
          <p>Their roles decide everything</p>
        </DialogCompanion>
      </Dialog>,
    );

    const beside = document.querySelector('[data-slot="dialog-companion"]');

    expect(beside?.contains(screen.getByText('Their roles decide everything'))).toBe(true);
    expect(beside?.contains(screen.getByText('Accounts'))).toBe(false);
  });

  it('takes the column away again once it is shut', () => {
    const { rerender } = render(
      <Dialog label="The server" isOpen onClose={vi.fn()}>
        <p>Accounts</p>

        <DialogCompanion label="What Sam may do" isOpen onClose={vi.fn()}>
          <p>Their roles decide everything</p>
        </DialogCompanion>
      </Dialog>,
    );

    expect(screen.getByText('Their roles decide everything')).toBeInTheDocument();

    rerender(
      <Dialog label="The server" isOpen onClose={vi.fn()}>
        <p>Accounts</p>

        <DialogCompanion label="What Sam may do" isOpen={false} onClose={vi.fn()}>
          <p>Their roles decide everything</p>
        </DialogCompanion>
      </Dialog>,
    );

    expect(screen.queryByText('Their roles decide everything')).not.toBeInTheDocument();
  });

  it('lies over the dialog it came from where there is no room to stand beside it', () => {
    noRoomBeside();

    render(
      <Dialog label="The server" isOpen onClose={vi.fn()}>
        <p>Accounts</p>

        <DialogCompanion label="What Sam may do" isOpen onClose={vi.fn()}>
          <p>Their roles decide everything</p>
        </DialogCompanion>
      </Dialog>,
    );

    expect(document.querySelector('[data-slot="dialog-companion"]')).toBeNull();
    expect(screen.getByText('Their roles decide everything')).toBeInTheDocument();
    expect(document.querySelector('[aria-label="What Sam may do"]')).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(DialogCompanion.displayName).toBe('DialogCompanion');
  });
});
