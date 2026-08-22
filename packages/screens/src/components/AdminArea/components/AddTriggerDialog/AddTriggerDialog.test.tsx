import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddTriggerDialog } from './AddTriggerDialog';
const build = (props: Partial<Parameters<typeof AddTriggerDialog>[0]> = {}) => (
  <AddTriggerDialog isOpen onAdd={vi.fn()} onClose={vi.fn()} {...props} />
);

/**
 * Picks an option out of one of the dialog's select menus.
 */
const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  field: string,
  option: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: field }));
  await user.click(await screen.findByRole('menuitemradio', { name: option }));
};

describe('AddTriggerDialog', () => {
  it('offers every trigger type Valence can schedule on', async () => {
    const user = userEvent.setup();
    render(build());

    await user.click(screen.getByRole('button', { name: 'Trigger type' }));

    for (const label of ['Daily', 'Weekly', 'On an interval', 'On application startup']) {
      expect(await screen.findByRole('menuitemradio', { name: label })).toBeInTheDocument();
    }
  });

  it('adds a daily trigger at the time given', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(build({ onAdd }));

    await user.clear(screen.getByLabelText('Time'));
    await user.type(screen.getByLabelText('Time'), '0230');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith({ kind: 'daily', hour: 2, minute: 30 });
  });

  it('asks for a day only once the trigger is weekly', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(build({ onAdd }));

    expect(screen.queryByRole('button', { name: 'Day' })).toBeNull();

    await pick(user, 'Trigger type', 'Weekly');
    await pick(user, 'Day', 'Wednesday');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith({ kind: 'weekly', dayOfWeek: 3, hour: 3, minute: 0 });
  });

  it('adds an interval in hours', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(build({ onAdd }));

    await pick(user, 'Trigger type', 'On an interval');
    await user.clear(screen.getByLabelText('Every'));
    await user.type(screen.getByLabelText('Every'), '12');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith({ kind: 'everyHours', hours: 12 });
  });

  it('adds an interval in minutes when the unit is switched', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(build({ onAdd }));

    await pick(user, 'Trigger type', 'On an interval');
    await pick(user, 'Unit', 'Minutes');
    await user.clear(screen.getByLabelText('Every'));
    await user.type(screen.getByLabelText('Every'), '15');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith({ kind: 'everyMinutes', minutes: 15 });
  });

  it('will not add an interval cron could not express', async () => {
    const user = userEvent.setup();
    render(build());

    await pick(user, 'Trigger type', 'On an interval');
    await pick(user, 'Unit', 'Minutes');
    await user.clear(screen.getByLabelText('Every'));
    await user.type(screen.getByLabelText('Every'), '90');

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('adds a startup trigger with nothing else to answer', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(build({ onAdd }));

    await pick(user, 'Trigger type', 'On application startup');

    expect(screen.queryByLabelText('Time')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith({ kind: 'startup' });
  });

  it('will not add a trigger whose time has been cleared', async () => {
    const user = userEvent.setup();
    render(build());

    await user.clear(screen.getByLabelText('Time'));

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('closes when Cancel is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(build({ onClose }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(AddTriggerDialog.displayName).toBe('AddTriggerDialog');
  });
});
