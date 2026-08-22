import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetPageCovers, isPageCovered } from '@ValenceUI/pageCover';
import { Dialog } from './Dialog';

afterEach(() => {
  forgetPageCovers();
});

describe('Dialog', () => {
  it('stands over the page while it is open, and stands down on the way out', () => {
    const { rerender } = render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    expect(isPageCovered()).toBe(true);

    rerender(
      <Dialog label="Arrival" isOpen={false} onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    expect(isPageCovered()).toBe(false);
  });

  it('shows nothing while closed', () => {
    render(
      <Dialog label="Arrival" isOpen={false} onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    expect(screen.queryByText('Details')).not.toBeInTheDocument();
  });

  it('names itself so it can be found', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Arrival' })).toBeInTheDocument();
  });

  it('closes on escape, which is what everyone tries first', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog label="Arrival" isOpen onClose={onClose}>
        <p>Details</p>
      </Dialog>,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('puts its overlay at the same height as its panel, so the last dialog opened is on top', () => {
    render(
      <Dialog label="Share" isOpen onClose={() => undefined}>
        <p>inside</p>
      </Dialog>,
    );

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    const panel = document.querySelector('[data-slot="dialog-content"]');

    expect(overlay?.className).toContain('z-50');
    expect(panel?.className).toContain('z-50');
  });

  it('blurs whatever it opened over, which on a second dialog is the first', () => {
    render(
      <Dialog label="Share" isOpen onClose={() => undefined}>
        <p>inside</p>
      </Dialog>,
    );

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');

    expect(overlay?.className).toContain('backdrop-blur-sm');
    expect(overlay?.className).not.toContain('z-40');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Dialog.displayName).toBe('Dialog');
  });

  it('hangs its motion on the attribute the primitive actually sets while leaving', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    const panel = screen.getByRole('dialog', { name: 'Arrival' });

    expect(panel.className).toContain('data-open:fade-in-0');
    expect(panel.className).toContain('data-closed:fade-out-0');
    expect(panel.className).toContain('data-closed:fade-out-0');
  });

  it('rises from the edge a thumb summoned it from, and settles in place on a desktop', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    const panel = screen.getByRole('dialog', { name: 'Arrival' });

    expect(panel.className).toContain('max-sm:data-open:slide-in-from-bottom-8');
    expect(panel.className).toContain('sm:data-open:zoom-in-95');
  });

  it('drops the movement, but not the fade, when movement is unwelcome', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Arrival' }).className).toContain(
      'motion-reduce:duration-[var(--duration-instant)]',
    );
  });
  it('leaves on a curve that can be seen, rather than one that front-loads the whole move', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Arrival' }).className).toContain(
      'data-closed:ease-[var(--ease-in-out)]',
    );
  });

  it('leaves the way it arrived, rather than being snatched away', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    const panel = screen.getByRole('dialog', { name: 'Arrival' });

    expect(panel.className).toContain('data-closed:duration-[var(--duration-leaving)]');
    expect(panel.className).toContain('sm:data-closed:zoom-out-95');
  });

  describe('in fullscreen', () => {
    /**
     * Says an element is fullscreen the way a browser reports it.
     */
    const goFullscreen = (element: Element | null) => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        value: element,
        writable: true,
      });

      document.dispatchEvent(new Event('fullscreenchange'));
    };

    afterEach(() => {
      goFullscreen(null);
    });

    it('lands on the fullscreen element though it is rendered outside that tree', () => {
      const stage = document.createElement('div');

      document.body.append(stage);
      goFullscreen(stage);

      render(
        <Dialog label="Arrival" isOpen onClose={vi.fn()}>
          <p>Details</p>
        </Dialog>,
      );

      expect(stage.contains(screen.getByText('Details'))).toBe(true);
    });

    it('goes back to the body when nothing is fullscreen', () => {
      const stage = document.createElement('div');

      document.body.append(stage);

      render(
        <Dialog label="Arrival" isOpen onClose={vi.fn()}>
          <p>Details</p>
        </Dialog>,
      );

      expect(stage.contains(screen.getByText('Details'))).toBe(false);
      expect(document.body.contains(screen.getByText('Details'))).toBe(true);
    });
  });
  it('stands a stage dialog at the same size whatever it holds', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()} size="stage">
        <span>Little</span>
      </Dialog>,
    );

    const panel = screen.getByRole('dialog', { name: 'Arrival' });

    expect(panel.className).toContain('sm:h-[88vh]');
    expect(panel.className).toContain('sm:max-h-[88vh]');
  });

  it('leaves an ordinary dialog to be the size of its contents', () => {
    render(
      <Dialog label="Rename" isOpen onClose={vi.fn()}>
        <span>Little</span>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Rename' }).className).not.toContain('sm:min-h-');
  });
});
