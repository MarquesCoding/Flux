import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('draws what it is given', () => {
    render(<Card>Figures</Card>);

    expect(screen.getByText('Figures')).toBeInTheDocument();
  });

  it('is a solid surface by default, since glass everywhere reads as fog', () => {
    const { container } = render(<Card>Figures</Card>);

    expect(container.firstChild).toHaveClass('valence-surface');
    expect(container.firstChild).not.toHaveClass('valence-glass');
  });

  it('can be glass, for a surface floating over artwork', () => {
    const { container } = render(<Card tone="glass">Figures</Card>);

    expect(container.firstChild).toHaveClass('valence-glass');
  });

  it('carries no material at all when its contents supply their own', () => {
    const { container } = render(<Card tone="plain">Figures</Card>);

    expect(container.firstChild).not.toHaveClass('valence-surface');
    expect(container.firstChild).not.toHaveClass('valence-glass');
  });

  it('lifts under a pointer only when it is a way somewhere', () => {
    const { container, rerender } = render(<Card>Figures</Card>);

    expect(container.firstChild).not.toHaveClass('valence-lift');

    rerender(<Card isInteractive>Figures</Card>);

    expect(container.firstChild).toHaveClass('valence-lift');
  });

  it('becomes whichever element the layout around it needs', () => {
    const { container } = render(<Card as="li">Figures</Card>);

    expect(container.querySelector('li')).toBeInTheDocument();
  });

  it('takes a class without losing its own', () => {
    const { container } = render(<Card className="w-64">Figures</Card>);

    expect(container.firstChild).toHaveClass('w-64');
    expect(container.firstChild).toHaveClass('valence-surface');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Card.displayName).toBe('Card');
  });
});
