import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActivityPanel } from './ActivityPanel';
import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin';
import type { Reason } from '@FluxContracts/schemas/PlaybackPlan';

const REASON: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const PLAYBACK = {
  mediaId: 'media-1',
  mediaTitle: 'Arrival',
  hasPoster: false,
  hasBackdrop: false,
  mode: 'direct' as const,
  plan: {
    mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    container: { kind: 'passthrough' as const, reason: REASON },
    video: { kind: 'passthrough' as const, reason: REASON },
    audio: { kind: 'passthrough' as const, streamIndex: 1, reason: REASON },
    subtitles: { kind: 'none' as const, reason: REASON },
  },
  isPlaying: true,
  pausedByAdmin: false,
  startedAt: 0,
  health: null,
};

const session = (overrides: Partial<ActiveSession> = {}): ActiveSession => ({
  clientId: 'cli_1',
  profileId: 'prf_1',
  profileName: 'Dan',
  deviceLabel: 'Chrome on macOS',
  connectedAt: 0,
  playback: null,
  ...overrides,
});

const props = {
  sessions: [],
  busyClientId: null,
  onStop: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
  onMessage: vi.fn(),
};

describe('ActivityPanel', () => {
  it('says the list is live, since a session list nobody trusts is no use', () => {
    render(<ActivityPanel {...props} />);

    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('says when nobody has the app open', () => {
    render(<ActivityPanel {...props} />);

    expect(screen.getByText('Nobody has the app open right now.')).toBeInTheDocument();
  });

  it('groups sessions under the viewer holding them', () => {
    render(<ActivityPanel {...props} sessions={[session(), session({ clientId: 'cli_2' })]} />);

    expect(screen.getAllByRole('heading', { name: 'Dan' })).toHaveLength(1);
  });

  it('carries a message back with the tab it was written for', async () => {
    const onMessage = vi.fn();

    render(
      <ActivityPanel
        {...props}
        onMessage={onMessage}
        sessions={[session({ playback: PLAYBACK })]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Message' }));
    await userEvent.type(screen.getByLabelText('Message for Dan'), 'Bed time.');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(onMessage).toHaveBeenCalledWith('cli_1', 'Bed time.');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(ActivityPanel.displayName).toBe('ActivityPanel');
  });
});
