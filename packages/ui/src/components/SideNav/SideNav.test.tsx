import { Tabs } from '@base-ui/react/tabs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SideNav } from './SideNav';
import type { SideNavGroup } from './SideNav.types';

const GROUPS: SideNavGroup[] = [
  { label: null, items: [{ id: 'overview', label: 'Overview' }] },
  {
    label: 'Activity',
    items: [
      { id: 'streams', label: 'Streams' },
      { id: 'jobs', label: 'Jobs' },
    ],
  },
];

const Harness = ({
  groups = GROUPS,
  onValueChange = vi.fn(),
}: {
  groups?: SideNavGroup[];
  onValueChange?: (value: string) => void;
}) => (
  <Tabs.Root
    defaultValue="overview"
    onValueChange={(next) => {
      onValueChange(String(next));
    }}
  >
    <SideNav groups={groups} label="Sections" />
  </Tabs.Root>
);

describe('SideNav', () => {
  it('names itself for a reader moving between landmarks', () => {
    render(<Harness />);

    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
  });

  it('shows every item across every group', () => {
    render(<Harness />);

    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('heads a group that has a name', () => {
    render(<Harness />);

    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('lets items sit above the first heading', () => {
    render(<Harness />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
  });

  it('marks which section is showing', () => {
    render(<Harness />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Jobs' })).toHaveAttribute('aria-selected', 'false');
  });

  it('chooses a section when one is pressed', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValueChange={onValueChange} />);

    await user.click(screen.getByRole('tab', { name: 'Jobs' }));

    expect(onValueChange).toHaveBeenCalledWith('jobs');
  });

  it('shows a badge beside the item it belongs to', () => {
    render(
      <Harness
        groups={[{ label: null, items: [{ id: 'overview', label: 'Overview', badge: '3' }] }]}
      />,
    );

    expect(screen.getByRole('tab', { name: /Overview/ })).toHaveTextContent('3');
  });

  it('keeps an icon out of the name a reader hears', () => {
    render(
      <Harness
        groups={[
          {
            label: null,
            items: [{ id: 'overview', label: 'Overview', icon: <span>ICON</span> }],
          },
        ]}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SideNav.displayName).toBe('SideNav');
  });
});
