import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu } from './ActionMenu';

const open = async () => {
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', { name: 'Actions' }));

  return user;
};

const props = {
  label: 'Actions',
  trigger: <span aria-hidden>x</span>,
};

describe('ActionMenu', () => {
  it('stays shut until it is asked for', () => {
    render(<ActionMenu {...props} groups={[{ items: [] }]} />);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('lists what can be done', async () => {
    render(
      <ActionMenu
        {...props}
        groups={[{ items: [{ id: 'scan', label: 'Run diagnostics', onChoose: vi.fn() }] }]}
      />,
    );

    await open();

    expect(await screen.findByRole('menuitem', { name: 'Run diagnostics' })).toBeInTheDocument();
  });

  it('does the thing that was chosen', async () => {
    const onChoose = vi.fn();

    render(
      <ActionMenu {...props} groups={[{ items: [{ id: 'scan', label: 'Scan', onChoose }] }]} />,
    );

    const user = await open();

    await user.click(await screen.findByRole('menuitem', { name: 'Scan' }));

    expect(onChoose).toHaveBeenCalled();
  });

  it('marks each row as somewhere the highlight can travel to', async () => {
    render(
      <ActionMenu
        {...props}
        groups={[{ items: [{ id: 'scan', label: 'Scan', onChoose: vi.fn() }] }]}
      />,
    );

    await open();

    expect(await screen.findByRole('menuitem', { name: 'Scan' })).toHaveAttribute(
      'data-highlight',
      'scan',
    );
  });

  it('colours a destructive action rather than merely listing it last', async () => {
    render(
      <ActionMenu
        {...props}
        groups={[
          { items: [{ id: 'x', label: 'Disconnect', isDestructive: true, onChoose: vi.fn() }] },
        ]}
      />,
    );

    await open();

    expect(await screen.findByRole('menuitem', { name: 'Disconnect' })).toHaveClass('text-danger');
  });

  it('refuses an action that cannot be taken', async () => {
    const onChoose = vi.fn();

    render(
      <ActionMenu
        {...props}
        groups={[{ items: [{ id: 'x', label: 'Export', isDisabled: true, onChoose }] }]}
      />,
    );

    const user = await open();

    await user.click(await screen.findByRole('menuitem', { name: 'Export' }));

    expect(onChoose).not.toHaveBeenCalled();
  });

  it('names a group of actions when the division needs explaining', async () => {
    render(
      <ActionMenu
        {...props}
        groups={[{ name: 'Danger', items: [{ id: 'x', label: 'Delete', onChoose: vi.fn() }] }]}
      />,
    );

    await open();

    expect(await screen.findByText('Danger')).toBeInTheDocument();
  });

  it('will not open when there is nothing to be done', () => {
    render(<ActionMenu {...props} isDisabled groups={[{ items: [] }]} />);

    expect(screen.getByRole('button', { name: 'Actions' })).toBeDisabled();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(ActionMenu.displayName).toBe('ActionMenu');
  });
});
