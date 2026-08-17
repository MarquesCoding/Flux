import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminMessageOverlay } from './AdminMessageOverlay';
describe('AdminMessageOverlay', () => {
  it('shows why the stream stopped', () => {
    render(
      <AdminMessageOverlay
        kind="stopped"
        text="This stream was stopped by an admin."
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('This stream was stopped by an admin.')).toBeInTheDocument();
  });

  it('calls onDismiss when closed after a stop', async () => {
    const onDismiss = vi.fn();

    render(<AdminMessageOverlay kind="stopped" text="Stopped." onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows why the stream was paused', () => {
    render(
      <AdminMessageOverlay
        kind="paused"
        text="This stream was paused by an admin."
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('This stream was paused by an admin.')).toBeInTheDocument();
  });

  it('calls onDismiss when the pause banner is dismissed', async () => {
    const onDismiss = vi.fn();

    render(<AdminMessageOverlay kind="paused" text="Paused." onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows a message as the lighter banner, since the picture is still there', () => {
    render(<AdminMessageOverlay kind="message" text="Tea is ready" onDismiss={vi.fn()} />);

    expect(screen.getByText('Tea is ready')).toBeInTheDocument();
  });

  it('wraps a message with nothing to break on rather than running off the screen', () => {
    const unbroken = 'Hey'.repeat(46);

    render(<AdminMessageOverlay kind="message" text={unbroken} onDismiss={vi.fn()} />);

    expect(screen.getByText(unbroken)).toHaveClass('break-words');
  });

  it('holds the banner to a readable width rather than letting it grow', () => {
    render(<AdminMessageOverlay kind="message" text={'Hey'.repeat(46)} onDismiss={vi.fn()} />);

    expect(screen.getByText('Hey'.repeat(46)).closest('div')).toHaveClass('max-w-lg');
  });

  it('lets a message be dismissed, since it took nothing away', async () => {
    const onDismiss = vi.fn();

    render(<AdminMessageOverlay kind="message" text="Tea is ready" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalled();
  });
});
