import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedIcon } from './AnimatedIcon';
import type * as MotionReact from 'motion/react';

const wants = { lessMovement: false };

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof MotionReact>('motion/react');

  return { ...actual, useReducedMotion: () => wants.lessMovement };
});

afterEach(() => {
  wants.lessMovement = false;
});

describe('AnimatedIcon', () => {
  it('draws the icon it was given', () => {
    render(<AnimatedIcon isPlaying={false} icon={<span data-testid="mark">mark</span>} />);

    expect(screen.getByTestId('mark')).toBeInTheDocument();
  });

  it('holds the filled twin ready for the gestures that fill', () => {
    render(
      <AnimatedIcon
        gesture="fill"
        isPlaying
        icon={<span data-testid="line">line</span>}
        activeIcon={<span data-testid="filled">filled</span>}
      />,
    );

    expect(screen.getByTestId('filled')).toBeInTheDocument();
  });

  it('hides the filled twin from a reader, the icon underneath having said it', () => {
    render(
      <AnimatedIcon
        gesture="fill"
        isPlaying
        icon={<span data-testid="line">line</span>}
        activeIcon={<span data-testid="filled">filled</span>}
      />,
    );

    expect(screen.getByTestId('filled').parentElement).toHaveAttribute('aria-hidden');
  });

  it('leaves the twin out of a gesture that does not fill', () => {
    render(
      <AnimatedIcon
        gesture="spin"
        isPlaying
        icon={<span data-testid="line">line</span>}
        activeIcon={<span data-testid="filled">filled</span>}
      />,
    );

    expect(screen.queryByTestId('filled')).not.toBeInTheDocument();
  });

  it('draws the icon and nothing else for somebody who asked for less movement', () => {
    wants.lessMovement = true;

    render(
      <AnimatedIcon
        gesture="fill"
        isPlaying
        icon={<span data-testid="line">line</span>}
        activeIcon={<span data-testid="filled">filled</span>}
      />,
    );

    expect(screen.getByTestId('line')).toBeInTheDocument();
    expect(screen.queryByTestId('filled')).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(AnimatedIcon.displayName).toBe('AnimatedIcon');
  });
});
