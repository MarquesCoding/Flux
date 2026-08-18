import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SlidingMark } from './SlidingMark';

describe('SlidingMark', () => {
  it('names the group it travels within, so two rows cannot share one mark', () => {
    const { container } = render(<SlidingMark group="nav-dock-mark" />);

    expect(container.querySelector('[data-mark="nav-dock-mark"]')).toBeInTheDocument();
  });

  it('sits behind whatever it is marking rather than over it', () => {
    const { container } = render(<SlidingMark group="grid-size-mark" />);

    expect(container.firstElementChild).toHaveClass('-z-10');
  });

  it('takes a shape from its caller, a row of pills not being the only thing to mark', () => {
    const { container } = render(<SlidingMark group="grid-size-mark" className="rounded-lg" />);

    expect(container.firstElementChild).toHaveClass('rounded-lg');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SlidingMark.displayName).toBe('SlidingMark');
  });
});
