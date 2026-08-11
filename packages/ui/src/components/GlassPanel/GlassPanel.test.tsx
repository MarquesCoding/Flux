import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GlassPanel } from './GlassPanel';

describe('GlassPanel', () => {
  it('shows what it was given', () => {
    render(<GlassPanel>Contents</GlassPanel>);

    expect(screen.getByText('Contents')).toBeInTheDocument();
  });

  it('floats over content by default', () => {
    const { container } = render(<GlassPanel>Contents</GlassPanel>);

    expect(container.firstElementChild).toHaveClass('flux-glass');
  });

  it('sits in the page when asked to', () => {
    const { container } = render(<GlassPanel elevation="inset">Contents</GlassPanel>);

    expect(container.firstElementChild).not.toHaveClass('flux-glass');
  });

  it('renders as whatever the content actually is', () => {
    render(
      <GlassPanel as="section" aria-label="Details">
        Contents
      </GlassPanel>,
    );

    expect(screen.getByRole('region', { name: 'Details' })).toBeInTheDocument();
  });

  it('takes extra classes without losing its material', () => {
    const { container } = render(<GlassPanel className="p-8">Contents</GlassPanel>);

    expect(container.firstElementChild).toHaveClass('flux-glass', 'p-8');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(GlassPanel.displayName).toBe('GlassPanel');
  });
});
