import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAnAddress } from '@FluxScreens/testing/renderInAnAddress';
import { SharesPanel } from './SharesPanel';
import type { AdminShare } from '@FluxContracts/schemas/Share';

const fetchEverybodysShares = vi.fn<() => Promise<AdminShare[]>>();
const revokeAnybodysShare = vi.fn<(shareId: string) => Promise<boolean>>();

vi.mock('@FluxClient/sharing/fetchShares', () => ({
  fetchEverybodysShares: () => fetchEverybodysShares(),
  revokeAnybodysShare: (shareId: string) => revokeAnybodysShare(shareId),
}));

const share = (overrides: Partial<AdminShare> = {}): AdminShare => ({
  id: 'share-1',
  kind: 'item',
  mediaId: 'media-1',
  seriesId: null,
  title: 'The Thing',
  createdAt: '2026-08-10T09:00:00.000Z',
  expiresAt: null,
  viewCap: null,
  views: 0,
  isRevoked: false,
  isSpent: false,
  createdBy: 'account-1',
  createdByName: 'Ada',
  ...overrides,
});

beforeEach(() => {
  fetchEverybodysShares.mockReset().mockResolvedValue([]);
  revokeAnybodysShare.mockReset().mockResolvedValue(true);
});

describe('SharesPanel', () => {
  it('lists what everybody has handed out', async () => {
    fetchEverybodysShares.mockResolvedValue([
      share(),
      share({ id: 'share-2', title: 'Another Thing', createdByName: 'Grace' }),
    ]);

    renderInAnAddress(<SharesPanel />);

    expect(await screen.findByText('The Thing')).toBeInTheDocument();
    expect(screen.getByText('Another Thing')).toBeInTheDocument();
  });

  it('says who handed each link out, which is the whole reason to look here', async () => {
    fetchEverybodysShares.mockResolvedValue([
      share(),
      share({ id: 'share-2', title: 'Another Thing', createdByName: 'Grace' }),
    ]);

    renderInAnAddress(<SharesPanel />);

    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Grace')).toBeInTheDocument();
  });

  it('can be sorted by who handed a link out, so one person’s can be read together', async () => {
    fetchEverybodysShares.mockResolvedValue([
      share({ createdByName: 'Zoe' }),
      share({ id: 'share-2', title: 'Another Thing', createdByName: 'Ada' }),
    ]);

    const user = userEvent.setup();

    renderInAnAddress(<SharesPanel />);

    await user.click(await screen.findByRole('button', { name: /Handed out by/ }));

    const [, first] = screen.getAllByRole('row');

    expect(first?.textContent).toContain('Ada');
  });

  it('says a link is live and what will end it, without claiming the reader made it', async () => {
    fetchEverybodysShares.mockResolvedValue([share()]);

    renderInAnAddress(<SharesPanel />);

    expect(await screen.findByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Until it is withdrawn')).toBeInTheDocument();
  });

  it('warns that withdrawing tells whoever made the link, and names them', async () => {
    fetchEverybodysShares.mockResolvedValue([share()]);

    const user = userEvent.setup();

    renderInAnAddress(<SharesPanel />);

    await user.click(await screen.findByRole('button', { name: 'Withdraw the link to The Thing' }));

    expect(await screen.findByText(/Ada’s link to The Thing/)).toBeInTheDocument();
    expect(screen.getByText(/They will be told it was withdrawn/)).toBeInTheDocument();
  });

  it('withdraws a link, and reads the list again once it has', async () => {
    fetchEverybodysShares.mockResolvedValue([share()]);

    const user = userEvent.setup();

    renderInAnAddress(<SharesPanel />);

    await user.click(await screen.findByRole('button', { name: 'Withdraw the link to The Thing' }));
    await user.click(await screen.findByRole('button', { name: 'Withdraw it' }));

    await waitFor(() => {
      expect(revokeAnybodysShare).toHaveBeenCalledWith('share-1');
    });

    await waitFor(() => {
      expect(fetchEverybodysShares).toHaveBeenCalledTimes(2);
    });
  });

  it('can be sorted by what a link points at, and by how far through its allowance it is', async () => {
    fetchEverybodysShares.mockResolvedValue([
      share({ title: 'Zodiac', views: 1 }),
      share({ id: 'share-2', title: 'Alien', views: 9 }),
    ]);

    const user = userEvent.setup();

    renderInAnAddress(<SharesPanel />);

    await user.click(await screen.findByRole('button', { name: /Link to/ }));

    expect(screen.getAllByRole('row')[1]?.textContent).toContain('Alien');

    await user.click(screen.getByRole('button', { name: /Opened/ }));

    expect(screen.getAllByRole('row')[1]?.textContent).toContain('Alien');
  });

  it('can be sorted by standing, so the ones still working can be read together', async () => {
    fetchEverybodysShares.mockResolvedValue([
      share({ isRevoked: true, isSpent: true }),
      share({ id: 'share-2', title: 'Working Thing' }),
    ]);

    const user = userEvent.setup();

    renderInAnAddress(<SharesPanel />);

    await user.click(await screen.findByRole('button', { name: /Standing/ }));

    const [, first] = screen.getAllByRole('row');

    expect(first?.textContent).toContain('Working Thing');
  });

  it('leaves a link alone where the confirmation is dismissed', async () => {
    fetchEverybodysShares.mockResolvedValue([share()]);

    const user = userEvent.setup();

    renderInAnAddress(<SharesPanel />);

    await user.click(await screen.findByRole('button', { name: 'Withdraw the link to The Thing' }));
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Withdraw it' })).not.toBeInTheDocument();
    });

    expect(revokeAnybodysShare).not.toHaveBeenCalled();
  });

  it('offers no way to withdraw a link that has already ended', async () => {
    fetchEverybodysShares.mockResolvedValue([share({ isRevoked: true, isSpent: true })]);

    renderInAnAddress(<SharesPanel />);

    expect(await screen.findByText('Withdrawn')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Withdraw the link to The Thing' }),
    ).not.toBeInTheDocument();
  });

  it('says plainly when nobody has handed anything out', async () => {
    renderInAnAddress(<SharesPanel />);

    expect(await screen.findByText('Nobody has handed out a link.')).toBeInTheDocument();
  });

  it('says nothing rather than an empty list while it is still reading', () => {
    renderInAnAddress(<SharesPanel />);

    expect(screen.getByLabelText('Reading the links')).toBeInTheDocument();
  });
});
