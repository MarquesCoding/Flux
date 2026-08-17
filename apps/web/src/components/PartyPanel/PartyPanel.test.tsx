import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PartyPanel } from './PartyPanel';
import type { PartyMember, WatchParty } from '@FluxContracts/schemas/WatchParty';

const member = (over?: Partial<PartyMember>): PartyMember => ({
  connectionId: 'dan',
  accountId: 'account-dan',
  profileId: null,
  name: 'Dan',
  role: 'host',
  joinedAtMs: 1000,
  isWatching: true,
  positionSeconds: 100,
  bufferedAheadSeconds: 10,
  ...over,
});

const party = (over?: Partial<WatchParty>): WatchParty => ({
  id: 'party-1',
  mediaId: 'a-film',
  createdAtMs: 1000,
  everyoneMaySeek: true,
  everyoneMayPlayPause: true,
  timekeeperId: 'dan',
  members: [member(), member({ connectionId: 'sam', name: 'Sam', role: 'guest' })],
  ...over,
});

describe('PartyPanel', () => {
  it('lists everybody in the party', () => {
    render(<PartyPanel party={party()} meConnectionId="dan" />);

    expect(screen.getByText(/Dan/)).toBeInTheDocument();
    expect(screen.getByText(/Sam/)).toBeInTheDocument();
  });

  it('counts how many are actually watching, not how many joined', () => {
    const mixed = party({
      members: [member(), member({ connectionId: 'sam', name: 'Sam', isWatching: false })],
    });

    render(<PartyPanel party={mixed} meConnectionId="dan" />);

    expect(screen.getByText(/1 watching/)).toBeInTheDocument();
  });

  it('says who is watching and who is not, since those are different things', () => {
    const mixed = party({
      members: [member(), member({ connectionId: 'sam', name: 'Sam', isWatching: false })],
    });

    render(<PartyPanel party={mixed} meConnectionId="dan" />);

    expect(screen.getByText('Watching')).toBeInTheDocument();
    expect(screen.getByText('Not watching')).toBeInTheDocument();
  });

  it('marks which one is you', () => {
    render(<PartyPanel party={party()} meConnectionId="dan" />);

    expect(screen.getByText(/Dan \(you\)/)).toBeInTheDocument();
  });

  it('says who is keeping time', () => {
    render(<PartyPanel party={party()} meConnectionId="dan" />);

    expect(screen.getByText('Keeping time')).toBeInTheDocument();
  });

  it('says how far out somebody has drifted', () => {
    const drifted = party({
      members: [member(), member({ connectionId: 'sam', name: 'Sam', positionSeconds: 96 })],
    });

    render(<PartyPanel party={drifted} meConnectionId="dan" />);

    expect(screen.getByText(/4.0s behind/)).toBeInTheDocument();
  });

  it('says nothing about drift for somebody close enough for it not to matter', () => {
    render(<PartyPanel party={party()} meConnectionId="dan" />);

    expect(screen.queryByText(/behind/)).not.toBeInTheDocument();
  });

  it('says which role each holds', () => {
    render(<PartyPanel party={party()} meConnectionId="dan" />);

    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });

  it('lets the host promote somebody', async () => {
    const actor = userEvent.setup();
    const onSetRole = vi.fn();

    render(<PartyPanel party={party()} meConnectionId="dan" onSetRole={onSetRole} />);
    await actor.click(screen.getByRole('button', { name: 'Make a co-host' }));

    expect(onSetRole).toHaveBeenCalledWith('sam', 'coHost');
  });

  it('does not offer a guest the controls for running the party', () => {
    render(<PartyPanel party={party()} meConnectionId="sam" onSetRole={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /co-host/ })).not.toBeInTheDocument();
  });

  it('does not offer a guest the switches for loosening it', () => {
    render(<PartyPanel party={party()} meConnectionId="sam" onLoosen={vi.fn()} />);

    expect(screen.queryByRole('switch', { name: /skip around/ })).not.toBeInTheDocument();
  });

  it('lets the host withhold skipping while leaving pausing shared', async () => {
    const actor = userEvent.setup();
    const onLoosen = vi.fn();

    render(<PartyPanel party={party()} meConnectionId="dan" onLoosen={onLoosen} />);
    await actor.click(screen.getByRole('switch', { name: /skip around/ }));

    expect(onLoosen).toHaveBeenCalledWith({ everyoneMaySeek: false });
  });

  it('explains why skipping is the one worth withholding', () => {
    render(<PartyPanel party={party()} meConnectionId="dan" onLoosen={vi.fn()} />);

    expect(screen.getByText(/throws everybody across the film/)).toBeInTheDocument();
  });

  it('offers a way out', async () => {
    const actor = userEvent.setup();
    const onLeave = vi.fn();

    render(<PartyPanel party={party()} meConnectionId="sam" onLeave={onLeave} />);
    await actor.click(screen.getByRole('button', { name: 'Leave' }));

    expect(onLeave).toHaveBeenCalled();
  });

  it('shows the link that puts somebody else in the party', () => {
    render(
      <PartyPanel
        party={party()}
        meConnectionId="dan"
        invitation="https://flux.local/watch/a-film?party=party-1"
      />,
    );

    expect(screen.getByText('https://flux.local/watch/a-film?party=party-1')).toBeInTheDocument();
  });

  it('says what the link does, since a bare address does not', () => {
    render(<PartyPanel party={party()} meConnectionId="dan" invitation="https://flux.local/x" />);

    expect(screen.getByText(/puts them in this party/)).toBeInTheDocument();
  });

  it('copies the link when asked', async () => {
    const actor = userEvent.setup();
    const onCopyInvitation = vi.fn(() => Promise.resolve());

    render(
      <PartyPanel
        party={party()}
        meConnectionId="dan"
        invitation="https://flux.local/x"
        onCopyInvitation={onCopyInvitation}
      />,
    );

    await actor.click(screen.getByRole('button', { name: 'Copy' }));

    expect(onCopyInvitation).toHaveBeenCalledWith('https://flux.local/x');
  });

  it('offers the link to a guest too, since anybody may bring somebody along', () => {
    render(<PartyPanel party={party()} meConnectionId="sam" invitation="https://flux.local/x" />);

    expect(screen.getByText('https://flux.local/x')).toBeInTheDocument();
  });

  it('shows no link where there is none to give', () => {
    render(<PartyPanel party={party()} meConnectionId="dan" />);

    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(PartyPanel.displayName).toBe('PartyPanel');
  });
});
