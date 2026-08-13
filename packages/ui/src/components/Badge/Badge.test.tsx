import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

const badgeOf = (text: string): HTMLElement => screen.getByText(text);

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

  it('paints a fact that is wrong differently from one that is merely notable', () => {
    render(<Badge tone="danger">NVENC</Badge>);

    expect(badgeOf('NVENC')).toHaveClass('border-danger/50');
  });
});
