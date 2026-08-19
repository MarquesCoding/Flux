import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StillWatchingDialog } from './StillWatchingDialog';

const props = {
  isOpen: true,
  title: 'The One With The Ending',
  secondsToAnswer: 90,
  onCarryOn: () => {},
  onGiveUp: () => {},
};

describe('StillWatchingDialog', () => {
  it('asks the question plainly', () => {
    render(<StillWatchingDialog {...props} />);

    expect(screen.getAllByText('Are you still watching?').length).toBeGreaterThan(0);
  });

  it('says what is waiting, so the answer is an informed one', () => {
    render(<StillWatchingDialog {...props} />);

    expect(screen.getByText(/The One With The Ending/)).toBeInTheDocument();
  });

  it('promises nothing will be marked as watched unless they say so', () => {
    render(<StillWatchingDialog {...props} />);

    expect(screen.getByText(/nothing marked as watched/)).toBeInTheDocument();
  });

  it('says how long is left rather than closing without warning', () => {
    render(<StillWatchingDialog {...props} />);

    expect(screen.getByText(/Stopping in 90 seconds/)).toBeInTheDocument();
  });

  it('carries on when somebody says they are there', async () => {
    const actor = userEvent.setup();
    const onCarryOn = vi.fn();

    render(<StillWatchingDialog {...props} onCarryOn={onCarryOn} />);
    await actor.click(screen.getByRole('button', { name: 'Still watching' }));

    expect(onCarryOn).toHaveBeenCalled();
  });

  it('stops when somebody says to stop', async () => {
    const actor = userEvent.setup();
    const onGiveUp = vi.fn();

    render(<StillWatchingDialog {...props} onGiveUp={onGiveUp} />);
    await actor.click(screen.getByRole('button', { name: 'Stop' }));

    expect(onGiveUp).toHaveBeenCalled();
  });

  it('counts down while nobody answers', async () => {
    vi.useFakeTimers();

    try {
      render(<StillWatchingDialog {...props} secondsToAnswer={5} />);

      expect(screen.getByText(/Stopping in 5 seconds/)).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(2000);

      expect(screen.getByText(/Stopping in 3 seconds/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up on its own when nobody answers at all', async () => {
    vi.useFakeTimers();

    try {
      const onGiveUp = vi.fn();

      render(<StillWatchingDialog {...props} secondsToAnswer={3} onGiveUp={onGiveUp} />);
      await vi.advanceTimersByTimeAsync(4000);

      expect(onGiveUp).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not give up while it is not even being asked', async () => {
    vi.useFakeTimers();

    try {
      const onGiveUp = vi.fn();

      render(
        <StillWatchingDialog {...props} isOpen={false} secondsToAnswer={1} onGiveUp={onGiveUp} />,
      );
      await vi.advanceTimersByTimeAsync(5000);

      expect(onGiveUp).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts its countdown afresh each time it is asked', async () => {
    const { rerender } = render(<StillWatchingDialog {...props} isOpen={false} />);

    rerender(<StillWatchingDialog {...props} isOpen />);

    await waitFor(() => {
      expect(screen.getByText(/Stopping in 90 seconds/)).toBeInTheDocument();
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(StillWatchingDialog.displayName).toBe('StillWatchingDialog');
  });
});
