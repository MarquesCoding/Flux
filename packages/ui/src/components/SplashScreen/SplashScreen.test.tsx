import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SplashScreen } from './SplashScreen';
import type * as MotionReact from 'motion/react';

const motion = vi.hoisted(() => ({ isReduced: false }));

vi.mock('motion/react', async () => ({
  ...(await vi.importActual<typeof MotionReact>('motion/react')),
  useReducedMotion: () => motion.isReduced,
}));

afterEach(() => {
  motion.isReduced = false;
});

describe('SplashScreen', () => {
  it('says something is happening, for anyone who cannot see the bar', () => {
    render(<SplashScreen />);

    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true');
  });

  it('shows the name of the instance', () => {
    render(<SplashScreen name="Living Room" />);

    expect(screen.getByText('Living Room')).toBeInTheDocument();
  });

  it('says what is being waited for when it is worth naming', () => {
    render(<SplashScreen label="Preparing your library" />);

    expect(screen.getByRole('status', { name: 'Preparing your library' })).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SplashScreen.displayName).toBe('SplashScreen');
  });

  it('shows a still bar rather than a travelling one when less motion was asked for', () => {
    motion.isReduced = true;

    render(<SplashScreen name="Valence" label="Loading" />);

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});
