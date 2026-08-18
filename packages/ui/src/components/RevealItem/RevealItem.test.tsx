import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RevealItem } from './RevealItem';
import type * as MotionModule from 'motion/react';

const { reducedMotion } = vi.hoisted(() => ({ reducedMotion: { current: false } }));

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof MotionModule>('motion/react');

  return { ...actual, useReducedMotion: () => reducedMotion.current };
});

describe('RevealItem', () => {
  it('is a list item, so a row of them is still a list', () => {
    render(
      <ul>
        <RevealItem index={0}>Arrival</RevealItem>
      </ul>,
    );

    expect(screen.getByRole('listitem')).toHaveTextContent('Arrival');
  });

  it('carries the class it is given, since the row decides how wide a card is', () => {
    render(
      <ul>
        <RevealItem index={0} className="w-72">
          Arrival
        </RevealItem>
      </ul>,
    );

    expect(screen.getByRole('listitem')).toHaveClass('w-72');
  });

  it('still shows its contents where somebody would rather things did not move', () => {
    reducedMotion.current = true;

    render(
      <ul>
        <RevealItem index={3}>Dune</RevealItem>
      </ul>,
    );

    expect(screen.getByRole('listitem')).toHaveTextContent('Dune');

    reducedMotion.current = false;
  });

  it('sets a display name so devtools can identify it', () => {
    expect(RevealItem.displayName).toBe('RevealItem');
  });
});
