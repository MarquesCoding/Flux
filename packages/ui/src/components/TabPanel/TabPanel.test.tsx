import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabPanel } from './TabPanel';
import { TabBar } from '@ValenceUI/TabBar';
import { Tabs } from '@ValenceUI/Tabs';

const tabs = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
];

const panels = (showing: string) => (
  <Tabs value={showing} onValueChange={vi.fn()}>
    <TabBar tabs={tabs} label="Sections" />
    <TabPanel value="one">The first</TabPanel>
    <TabPanel value="two" className="rounded-2xl">
      The second
    </TabPanel>
  </Tabs>
);

describe('TabPanel', () => {
  it('is a tab panel to anything reading the page', () => {
    render(panels('one'));

    expect(screen.getByRole('tabpanel')).toHaveTextContent('The first');
  });

  it('takes its name from the tab that opens it', () => {
    render(panels('one'));

    expect(screen.getByRole('tabpanel', { name: 'One' })).toBeInTheDocument();
  });

  it('keeps a hidden panel out of the document rather than merely invisible', () => {
    render(panels('one'));

    expect(screen.queryByText('The second')).not.toBeInTheDocument();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('carries the classes it was given', () => {
    render(panels('two'));

    expect(screen.getByRole('tabpanel')).toHaveClass('rounded-2xl');
  });

  it('renders as whatever it was told to be', () => {
    render(
      <Tabs value="one" onValueChange={vi.fn()}>
        <TabPanel value="one" render={<section />}>
          The first
        </TabPanel>
      </Tabs>,
    );

    expect(screen.getByRole('tabpanel').tagName).toBe('SECTION');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(TabPanel.displayName).toBe('TabPanel');
  });
});
