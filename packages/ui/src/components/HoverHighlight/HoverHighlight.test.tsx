import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HoverHighlight } from './HoverHighlight';
import type * as MotionReact from 'motion/react';

const motion = vi.hoisted(() => ({ isReduced: false }));

vi.mock('motion/react', async () => ({
  ...(await vi.importActual<typeof MotionReact>('motion/react')),
  useReducedMotion: () => motion.isReduced,
}));

const SOMEWHERE = { left: 8, top: 4, width: 120, height: 36 };

afterEach(() => {
  motion.isReduced = false;
});

describe('HoverHighlight', () => {
  it('draws nothing while no pointer rests on anything', () => {
    const { container } = render(<HoverHighlight rect={null} />);

    expect(container.querySelector('span')).toBeNull();
  });

  it('appears once there is somewhere to be', () => {
    const { container } = render(<HoverHighlight rect={SOMEWHERE} />);

    expect(container.querySelector('span')).toBeInTheDocument();
  });

  it('is hidden from a screen reader, being decoration rather than content', () => {
    const { container } = render(<HoverHighlight rect={SOMEWHERE} />);

    expect(container.querySelector('span')).toHaveAttribute('aria-hidden');
  });

  it('takes no pointer events, so it cannot steal the hover that moves it', () => {
    const { container } = render(<HoverHighlight rect={SOMEWHERE} />);

    expect(container.querySelector('span')).toHaveClass('pointer-events-none');
  });

  it('rounds itself like whatever it slides over', () => {
    const { container } = render(<HoverHighlight rect={SOMEWHERE} radius="pill" />);

    expect(container.querySelector('span')).toHaveClass('rounded-full');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(HoverHighlight.displayName).toBe('HoverHighlight');
  });

  it('appears where it is wanted at once when less motion was asked for', () => {
    motion.isReduced = true;

    const { container } = render(<HoverHighlight rect={SOMEWHERE} />);

    expect(container.querySelector('span')).toBeInTheDocument();
  });
});
