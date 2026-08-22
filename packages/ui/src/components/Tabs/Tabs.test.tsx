import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';
import { TabBar } from '@ValenceUI/TabBar';
import { TabPanel } from '@ValenceUI/TabPanel';

const tabs = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
];

describe('Tabs', () => {
  it('shows the panel belonging to the tab it was given', () => {
    render(
      <Tabs value="two" onValueChange={vi.fn()}>
        <TabBar tabs={tabs} label="Sections" />
        <TabPanel value="one">The first</TabPanel>
        <TabPanel value="two">The second</TabPanel>
      </Tabs>,
    );

    expect(screen.getByText('The second')).toBeInTheDocument();
    expect(screen.queryByText('The first')).not.toBeInTheDocument();
  });

  it('lays nothing out, so a page can put the bar and the panels where it likes', () => {
    const { container } = render(
      <Tabs value="one" onValueChange={vi.fn()}>
        <TabPanel value="one">The first</TabPanel>
      </Tabs>,
    );

    expect(container.firstElementChild).toHaveClass('contents');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Tabs.displayName).toBe('Tabs');
  });
});
