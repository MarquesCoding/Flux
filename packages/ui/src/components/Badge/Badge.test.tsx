import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

/**
 * The badge itself, rather than the span its words sit in.
 *
 * The text is wrapped one level deeper so it can be nudged onto the optical
 * centre line, which means the tone and the shape live on the parent.
 */
const badgeOf = (text: string): HTMLElement | null => screen.getByText(text).parentElement;

describe('Badge', () => {
  it('states what it was given', () => {
    render(<Badge>4K</Badge>);

    expect(screen.getByText('4K')).toBeInTheDocument();
  });

  it('is not something anyone can press', () => {
    render(<Badge>4K</Badge>);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('states a fact quietly by default', () => {
    render(<Badge>HDR10</Badge>);

    expect(badgeOf('HDR10')).toHaveClass('text-text-muted');
  });

  it('speaks up when something matters', () => {
    render(<Badge tone="accent">New</Badge>);

    expect(screen.getByText('New')).not.toHaveClass('text-text-muted');
  });

  it('stays readable on artwork rather than dissolving into it', () => {
    render(<Badge tone="solid">TV-14</Badge>);

    expect(badgeOf('TV-14')).toHaveClass('bg-black/60');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Badge.displayName).toBe('Badge');
  });
});
