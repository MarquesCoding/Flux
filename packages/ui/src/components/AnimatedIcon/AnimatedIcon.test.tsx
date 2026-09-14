import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedIcon } from './AnimatedIcon';
import type * as MotionReact from 'motion/react';

const wants = { lessMovement: false };

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof MotionReact>('motion/react');

  return {
    ...actual,
    useReducedMotion: () => wants.lessMovement,
    useReducedMotionConfig: () => wants.lessMovement,
  };
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

  it('puts a half-played gesture back where it rests', async () => {
    const view = render(
      <AnimatedIcon
        gesture="fill"
        isPlaying={false}
        icon={<span data-testid="line" />}
        activeIcon={<span data-testid="filled" />}
      />,
    );

    view.rerender(
      <AnimatedIcon
        gesture="fill"
        isPlaying
        icon={<span data-testid="line" />}
        activeIcon={<span data-testid="filled" />}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('filled').parentElement).toHaveStyle({
        clipPath: 'inset(0% 0% 0% 0%)',
      });
    });

    view.rerender(
      <AnimatedIcon
        gesture="fill"
        isPlaying
        isStilled
        icon={<span data-testid="line" />}
        activeIcon={<span data-testid="filled" />}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('filled').parentElement).toHaveStyle({
        clipPath: 'inset(100% 0% 0% 0%)',
      });
    });
  });

  it('keeps what it wraps mounted while it is stilled', () => {
    const view = render(
      <AnimatedIcon gesture="ring" isPlaying icon={<span data-testid="trigger" />} />,
    );

    const before = screen.getByTestId('trigger');

    view.rerender(
      <AnimatedIcon gesture="ring" isPlaying isStilled icon={<span data-testid="trigger" />} />,
    );

    expect(screen.getByTestId('trigger')).toBe(before);
  });

  it('holds still under a pointer where it is asked for no gesture at all, as a face is', async () => {
    render(<AnimatedIcon gesture="none" isPlaying icon={<span data-testid="face">face</span>} />);

    await new Promise((settle) => {
      setTimeout(settle, 50);
    });

    expect(screen.getByTestId('face').parentElement?.style.transform ?? '').not.toContain(
      'translate',
    );
  });

  it('sets a display name so devtools can identify it', () => {
    expect(AnimatedIcon.displayName).toBe('AnimatedIcon');
  });
});
