import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SectionBar } from './SectionBar';
import type { SectionBarGroup } from './SectionBar.types';

const GROUPS: readonly SectionBarGroup[] = [
  { items: [{ id: 'overview', label: 'Overview' }] },
  {
    label: 'Activity',
    items: [
      { id: 'activity', label: 'Sessions' },
      { id: 'jobs', label: 'Jobs' },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'libraries', label: 'Libraries' },
      { id: 'media', label: 'Media' },
    ],
  },
  { label: 'System', items: [{ id: 'settings', label: 'Settings' }] },
];

const draw = (value = 'overview', onValueChange = vi.fn()) => {
  const view = render(
    <SectionBar
      label="What to look at"
      groups={GROUPS}
      value={value}
      onValueChange={onValueChange}
    />,
  );

  return { view, onValueChange };
};

describe('SectionBar', () => {
  it('says what it chooses between, for anybody who cannot see it', () => {
    draw();

    expect(screen.getByRole('navigation', { name: 'What to look at' })).toBeInTheDocument();
  });

  it('shows a family as one place rather than as its contents', () => {
    draw();

    expect(screen.getByRole('button', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sessions' })).not.toBeInTheDocument();
  });

  it('goes straight to a section that belongs to no family', async () => {
    const user = userEvent.setup();
    const { onValueChange } = draw('jobs');

    await user.click(screen.getByRole('button', { name: 'Overview' }));

    expect(onValueChange).toHaveBeenCalledWith('overview');
  });

  it('does not make a menu of a family holding one section', async () => {
    const user = userEvent.setup();
    const { onValueChange } = draw();

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(onValueChange).toHaveBeenCalledWith('settings');
  });

  it('keeps a family’s own name whichever of its sections is showing', () => {
    draw('jobs');

    expect(screen.getByRole('button', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Jobs' })).not.toBeInTheDocument();
  });

  it('opens a family when it is pressed, and names what is inside', async () => {
    const user = userEvent.setup();

    draw();

    await user.click(screen.getByRole('button', { name: 'Activity' }));

    const opened = await screen.findByRole('menu', { name: 'Activity' });

    expect(within(opened).getByRole('menuitemradio', { name: 'Sessions' })).toBeInTheDocument();
    expect(within(opened).getByRole('menuitemradio', { name: 'Jobs' })).toBeInTheDocument();
  });

  it('moves to a section chosen from inside a family', async () => {
    const user = userEvent.setup();
    const { onValueChange } = draw();

    await user.click(screen.getByRole('button', { name: 'Content' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Media' }));

    expect(onValueChange).toHaveBeenCalledWith('media');
  });

  it('marks which section of an open family is the one being shown', async () => {
    const user = userEvent.setup();

    draw('jobs');

    await user.click(screen.getByRole('button', { name: 'Activity' }));

    expect(await screen.findByRole('menuitemradio', { name: 'Jobs' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('closes one family when another opens, so two are never up at once', async () => {
    const user = userEvent.setup();

    draw();

    await user.click(screen.getByRole('button', { name: 'Activity' }));
    await screen.findByRole('menu', { name: 'Activity' });

    await user.click(screen.getByRole('button', { name: 'Content' }));
    await screen.findByRole('menu', { name: 'Content' });

    expect(screen.queryByRole('menu', { name: 'Activity' })).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SectionBar.displayName).toBe('SectionBar');
  });
});
