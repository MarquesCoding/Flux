import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOpenAction } from './useOpenAction';

/**
 * A dock's worth of actions, each marked the way the real one marks them, so a test can open and
 * shut a panel the way Base UI does — by stamping the attribute on the trigger.
 */
const Actions = ({ openId }: { openId: string | null }) => {
  const { actionsRef, openAction } = useOpenAction();

  return (
    <div>
      <span data-testid="open">{openAction ?? 'none'}</span>

      <div ref={actionsRef}>
        {['surprise', 'notifications'].map((id) => (
          <div key={id} data-highlight={id}>
            <span aria-expanded={openId === id}>{id}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const openNow = () => document.querySelector('[data-testid="open"]')?.textContent;

describe('useOpenAction', () => {
  it('says nothing is open when nothing is', async () => {
    render(<Actions openId={null} />);

    await waitFor(() => {
      expect(openNow()).toBe('none');
    });
  });

  it('names the action whose panel is open at the moment it mounts', async () => {
    render(<Actions openId="surprise" />);

    await waitFor(() => {
      expect(openNow()).toBe('surprise');
    });
  });

  it('notices a panel opening', async () => {
    const view = render(<Actions openId={null} />);

    view.rerender(<Actions openId="notifications" />);

    await waitFor(() => {
      expect(openNow()).toBe('notifications');
    });
  });

  it('notices a panel shutting', async () => {
    const view = render(<Actions openId="surprise" />);

    await waitFor(() => {
      expect(openNow()).toBe('surprise');
    });

    view.rerender(<Actions openId={null} />);

    await waitFor(() => {
      expect(openNow()).toBe('none');
    });
  });

  it('names the action the open trigger belongs to, not the trigger itself', async () => {
    render(<Actions openId="notifications" />);

    await waitFor(() => {
      expect(openNow()).toBe('notifications');
    });
  });
});
