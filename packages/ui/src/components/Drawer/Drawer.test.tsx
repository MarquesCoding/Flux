import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('shows what it holds while open', () => {
    render(
      <Drawer label="Search" isOpen onClose={vi.fn()}>
        <p>Filters</p>
      </Drawer>,
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('shows nothing while closed', () => {
    render(
      <Drawer label="Search" isOpen={false} onClose={vi.fn()}>
        <p>Filters</p>
      </Drawer>,
    );

    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
  });

  it('names itself so it can be found', () => {
    render(
      <Drawer label="Search" isOpen onClose={vi.fn()}>
        <p>Filters</p>
      </Drawer>,
    );

    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
  });

  it('closes on escape, which is what everyone tries first', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Drawer label="Search" isOpen onClose={onClose}>
        <p>Filters</p>
      </Drawer>,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('stands at the foot of the screen and spans its width', () => {
    render(
      <Drawer label="Search" isOpen onClose={vi.fn()}>
        <p>Filters</p>
      </Drawer>,
    );

    const panel = screen.getByRole('dialog', { name: 'Search' });

    expect(panel.className).toContain('bottom-0');
    expect(panel.className).toContain('sm:w-full');
    expect(panel.className).not.toContain('sm:-translate-x-1/2');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Drawer.displayName).toBe('Drawer');
  });
});
