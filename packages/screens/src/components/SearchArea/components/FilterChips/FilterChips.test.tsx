import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterChips } from './FilterChips';

const OPTIONS = [
  { value: '1990', label: '1990s' },
  { value: '2000', label: '2000s' },
];

describe('FilterChips', () => {
  it('offers everything there is to choose from', () => {
    render(<FilterChips legend="Decade" options={OPTIONS} value={null} onValueChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: '1990s' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2000s' })).toBeInTheDocument();
  });

  it('reports what was chosen', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();

    render(
      <FilterChips legend="Decade" options={OPTIONS} value={null} onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole('button', { name: '1990s' }));

    expect(onValueChange).toHaveBeenCalledWith('1990');
  });

  it('lets the chosen one be pressed again to take it off', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();

    render(
      <FilterChips legend="Decade" options={OPTIONS} value="1990" onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole('button', { name: '1990s' }));

    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it('says which one is in force rather than only colouring it', () => {
    render(<FilterChips legend="Decade" options={OPTIONS} value="1990" onValueChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: '1990s' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('names what the row narrows', () => {
    render(<FilterChips legend="Decade" options={OPTIONS} value={null} onValueChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Decade' })).toBeInTheDocument();
  });

  it('draws nothing at all when the library offers no such thing', () => {
    const { container } = render(
      <FilterChips legend="Decade" options={[]} value={null} onValueChange={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(FilterChips.displayName).toBe('FilterChips');
  });
});
