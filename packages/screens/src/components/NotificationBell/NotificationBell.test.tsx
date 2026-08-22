import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';
import type { Notification } from '@FluxContracts/schemas/Notification';

const aNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  event: 'media.added',
  title: 'Something new to watch',
  body: '12 episodes — The Office',
  link: '/?show=s1',
  createdAt: new Date().toISOString(),
  readAt: null,
  ...overrides,
});

const draw = (overrides: Partial<Parameters<typeof NotificationBell>[0]> = {}) => {
  const props = {
    notifications: [],
    unread: 0,
    onOpen: vi.fn(),
    onRead: vi.fn(),
    onReadAll: vi.fn(),
    onClearAll: vi.fn(),
    onFollow: vi.fn(),
    ...overrides,
  };

  render(<NotificationBell {...props} />);

  return props;
};

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Notifications' }));
};

describe('NotificationBell', () => {
  it('shows no count when there is nothing unread', () => {
    draw({ notifications: [aNotification({ readAt: new Date().toISOString() })] });

    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('counts what is unread', () => {
    draw({ unread: 3 });

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('stops counting past a point rather than reflowing the dock', () => {
    draw({ unread: 42 });

    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('says what this is for when nothing has happened', async () => {
    const user = userEvent.setup();

    draw();
    await open(user);

    expect(await screen.findByText(/New films and episodes will show up here/)).toBeInTheDocument();
  });

  it('reads the list again when it is opened', async () => {
    const user = userEvent.setup();
    const { onOpen } = draw();

    await open(user);

    expect(onOpen).toHaveBeenCalled();
  });

  it('does not clear anything merely by being looked at', async () => {
    const user = userEvent.setup();
    const { onRead, onReadAll } = draw({ notifications: [aNotification()], unread: 1 });

    await open(user);

    expect(onRead).not.toHaveBeenCalled();
    expect(onReadAll).not.toHaveBeenCalled();
  });

  it('clears the lot on a press', async () => {
    const user = userEvent.setup();
    const { onReadAll } = draw({ notifications: [aNotification()], unread: 1 });

    await open(user);
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }));

    expect(onReadAll).toHaveBeenCalled();
  });

  it('offers nothing to clear when nothing is unread', async () => {
    const user = userEvent.setup();

    draw({ notifications: [aNotification({ readAt: new Date().toISOString() })], unread: 0 });
    await open(user);

    expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument();
  });

  it('follows a notification that has somewhere to go, and marks it read', async () => {
    const user = userEvent.setup();
    const { onRead, onFollow } = draw({ notifications: [aNotification()], unread: 1 });

    await open(user);
    await user.click(await screen.findByText('12 episodes — The Office'));

    expect(onRead).toHaveBeenCalledWith(aNotification().id);
    expect(onFollow).toHaveBeenCalledWith('/?show=s1');
  });

  it('marks a notification with nowhere to go read without navigating', async () => {
    const user = userEvent.setup();
    const { onRead, onFollow } = draw({
      notifications: [aNotification({ link: null })],
      unread: 1,
    });

    await open(user);
    await user.click(await screen.findByText('12 episodes — The Office'));

    expect(onRead).toHaveBeenCalled();
    expect(onFollow).not.toHaveBeenCalled();
  });

  it('does not offer push where the browser or server cannot do it', async () => {
    const user = userEvent.setup();

    draw();
    await open(user);

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('offers push where it is available', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    draw({ push: { isOn: false, onToggle } });
    await open(user);

    await user.click(await screen.findByRole('switch'));

    expect(onToggle).toHaveBeenCalled();
  });

  it('offers a way to take them off the bell entirely, not only to mark them seen', async () => {
    const user = userEvent.setup();
    const props = draw({ notifications: [aNotification({})] });

    await open(user);
    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(props.onClearAll).toHaveBeenCalled();
  });

  it('offers nothing to clear when there is nothing on it', async () => {
    const user = userEvent.setup();

    draw({ notifications: [] });

    await open(user);

    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
  });
});
