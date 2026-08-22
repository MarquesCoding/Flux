import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TabBar } from './TabBar';
import { TabPanel } from '@ValenceUI/TabPanel';
import { Tabs } from '@ValenceUI/Tabs';

const tabs = [
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'New' },
  { id: 'films', label: 'Films' },
];

const Harness = ({
  startAt,
  onValueChange,
}: {
  startAt: string;
  onValueChange?: (next: string) => void;
}) => {
  const [value, setValue] = useState(startAt);

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
    >
      <TabBar tabs={tabs} label="Browse" />
      <TabPanel value="trending">What is trending</TabPanel>
      <TabPanel value="new">What is new</TabPanel>
      <TabPanel value="films">The films</TabPanel>
    </Tabs>
  );
};

const bar = (value: string, onValueChange: (next: string) => void = vi.fn()) => (
  <Harness startAt={value} onValueChange={onValueChange} />
);

describe('TabBar', () => {
  it('names itself, since a page may carry more than one', () => {
    render(bar('trending'));

    expect(screen.getByRole('tablist', { name: 'Browse' })).toBeInTheDocument();
  });

  it('offers every tab', () => {
    render(bar('trending'));

    for (const tab of tabs) {
      expect(screen.getByRole('tab', { name: tab.label })).toBeInTheDocument();
    }
  });

  it('says which tab is showing', () => {
    render(bar('new'));

    expect(screen.getByRole('tab', { name: 'New' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Films' })).toHaveAttribute('aria-selected', 'false');
  });

  it('changes tab on request', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(bar('trending', onValueChange));

    await user.click(screen.getByRole('tab', { name: 'Films' }));

    expect(onValueChange).toHaveBeenCalledWith('films');
  });

  it('moves focus along the row with the arrow keys, which a row of buttons cannot', async () => {
    const user = userEvent.setup();
    render(bar('trending'));

    await user.click(screen.getByRole('tab', { name: 'Trending' }));
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'New' })).toHaveFocus();
  });

  it('waits to be asked before changing tab, so arrowing past one does not load it', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(bar('trending', onValueChange));

    await user.click(screen.getByRole('tab', { name: 'Trending' }));
    await user.keyboard('{ArrowRight}');

    expect(onValueChange).not.toHaveBeenCalledWith('new');

    await user.keyboard('{Enter}');

    expect(onValueChange).toHaveBeenLastCalledWith('new');
  });

  it('holds one stop on the way through the page, not one per tab', async () => {
    const user = userEvent.setup();
    render(bar('new'));

    await user.tab();

    expect(screen.getByRole('tab', { name: 'New' })).toHaveFocus();
  });

  it('says which panel each tab is for', () => {
    render(bar('trending'));

    const tab = screen.getByRole('tab', { name: 'Trending' });
    const panel = screen.getByRole('tabpanel');

    expect(tab).toHaveAttribute('aria-controls', panel.id);
  });

  it('scrolls rather than wrapping, since a phone will not fit them', () => {
    render(bar('trending'));

    expect(screen.getByRole('tablist', { name: 'Browse' })).toHaveClass('overflow-x-auto');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(TabBar.displayName).toBe('TabBar');
  });
});
