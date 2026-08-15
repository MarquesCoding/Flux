import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
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

  it('sets a display name so devtools can identify it', () => {
    expect(Dialog.displayName).toBe('Dialog');
  });

  it('arrives and leaves rather than appearing and vanishing', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    const panel = screen.getByRole('dialog', { name: 'Arrival' });

    expect(panel.className).toContain('data-[starting-style]:opacity-0');
    expect(panel.className).toContain('data-[ending-style]:opacity-0');
  });

  it('rises from the edge a thumb summoned it from, and settles in place on a desktop', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    const panel = screen.getByRole('dialog', { name: 'Arrival' });

    expect(panel.className).toContain('max-sm:data-[starting-style]:translate-y-10');
    expect(panel.className).toContain('sm:data-[starting-style]:scale-[0.92]');
  });

  it('drops the movement, but not the fade, when movement is unwelcome', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Arrival' }).className).toContain(
      'motion-reduce:transition-opacity',
    );
  });
  it('leaves the way it arrived, rather than being snatched away', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    );

    const panel = screen.getByRole('dialog', { name: 'Arrival' });

    expect(panel.className).toContain('duration-[280ms]');
    expect(panel.className).not.toContain('data-[ending-style]:duration-150');
    expect(panel.className).toContain('sm:data-[ending-style]:scale-[0.92]');
  });

  describe('in fullscreen', () => {
    /**
     * Says an element is fullscreen the way a browser reports it.
     *
     * jsdom implements neither `requestFullscreen` nor `fullscreenElement`,
     * so the property is set and the event dispatched by hand.
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
});
