import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityPanel } from './ActivityPanel';
import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin';

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

  it('sets a display name so devtools can identify it', () => {
    expect(ActivityPanel.displayName).toBe('ActivityPanel');
  });
});
