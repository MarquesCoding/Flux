import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('says nothing to a screen reader by default', () => {
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('says what is coming when it is the one thing standing in for it', () => {
    render(<Skeleton label="Loading the cast" />);

    expect(screen.getByRole('status', { name: 'Loading the cast' })).toBeInTheDocument();
  });

  it('holds the shape it was given, so nothing moves when content lands', () => {
    const { container } = render(<Skeleton className="h-16 w-16" />);

    expect(container.firstElementChild).toHaveClass('h-16', 'w-16');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Skeleton.displayName).toBe('Skeleton');
  });
});
