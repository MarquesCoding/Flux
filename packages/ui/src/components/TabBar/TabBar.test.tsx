import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TabBar } from './TabBar';

const tabs = [
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'New' },
  { id: 'films', label: 'Films' },
];

describe('TabBar', () => {
  it('names itself, since a page may carry more than one', () => {
    render(<TabBar tabs={tabs} selectedId="trending" onSelect={vi.fn()} label="Browse" />);

    expect(screen.getByRole('navigation', { name: 'Browse' })).toBeInTheDocument();
  });

  it('offers every tab', () => {
    render(<TabBar tabs={tabs} selectedId="trending" onSelect={vi.fn()} label="Browse" />);

    for (const tab of tabs) {
      expect(screen.getByRole('button', { name: tab.label })).toBeInTheDocument();
    }
  });

  it('says which tab is showing', () => {
    render(<TabBar tabs={tabs} selectedId="new" onSelect={vi.fn()} label="Browse" />);

    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('aria-current', 'page');
  });

  it('changes tab on request', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<TabBar tabs={tabs} selectedId="trending" onSelect={onSelect} label="Browse" />);

    await user.click(screen.getByRole('button', { name: 'Films' }));

    expect(onSelect).toHaveBeenCalledWith('films');
  });

  it('scrolls rather than wrapping, since a phone will not fit them', () => {
    const { container } = render(
      <TabBar tabs={tabs} selectedId="trending" onSelect={vi.fn()} label="Browse" />,
    );

    expect(container.firstElementChild).toHaveClass('overflow-x-auto');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(TabBar.displayName).toBe('TabBar');
  });
});
