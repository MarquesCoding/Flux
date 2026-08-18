import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInACache } from '@FluxWeb/testing/renderInACache';
import { SharePanel } from './SharePanel';
import type { Share } from '@FluxContracts/schemas/Share';

const fetchShares = vi.fn<() => Promise<Share[]>>();
const revokeShare = vi.fn<(shareId: string) => Promise<boolean>>();

vi.mock('@FluxWeb/sharing/fetchShares', () => ({
  fetchShares: () => fetchShares(),
  revokeShare: (shareId: string) => revokeShare(shareId),
}));

const share = (overrides: Partial<Share> = {}): Share => ({
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
  ...overrides,
});

beforeEach(() => {
  fetchShares.mockReset().mockResolvedValue([]);
  revokeShare.mockReset().mockResolvedValue(true);
});

/**
 * Withdraws a link the way a person does: the button on the row, then the confirmation.
 */
const withdraw = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
  await user.click(await screen.findByRole('button', { name: `Withdraw the link to ${title}` }));
  await user.click(await screen.findByRole('button', { name: 'Withdraw it' }));
};

describe('SharePanel', () => {
  it('lists the links this account has handed out', async () => {
    fetchShares.mockResolvedValue([share(), share({ id: 'share-2', title: 'Another Thing' })]);

    renderInACache(<SharePanel />);

    expect(await screen.findByText('The Thing')).toBeInTheDocument();
    expect(screen.getByText('Another Thing')).toBeInTheDocument();
  });

  it('says a link covers a whole series, since that is a different thing to have handed out', async () => {
    fetchShares.mockResolvedValue([share({ kind: 'series', mediaId: null, seriesId: 'series-1' })]);

    renderInACache(<SharePanel />);

    expect(await screen.findByText('Whole series')).toBeInTheDocument();
  });

  it('says a working link is live and what will end it', async () => {
    fetchShares.mockResolvedValue([share()]);

    renderInACache(<SharePanel />);

    expect(await screen.findByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Until you withdraw it')).toBeInTheDocument();
  });

  it('says what will end a link, whether that is a date or an allowance', async () => {
    fetchShares.mockResolvedValue([
      share({ expiresAt: '2099-01-01T00:00:00.000Z' }),
      share({ id: 'share-2', title: 'Counted Thing', viewCap: 3 }),
    ]);

    renderInACache(<SharePanel />);

    expect(await screen.findByText(/Runs out/)).toBeInTheDocument();
    expect(screen.getByText('Until it has been opened enough times')).toBeInTheDocument();
  });

  it('can be sorted by what a link points at', async () => {
    fetchShares.mockResolvedValue([
      share({ title: 'Zodiac' }),
      share({ id: 'share-2', title: 'Alien' }),
    ]);

    const user = userEvent.setup();

    renderInACache(<SharePanel />);

    await user.click(await screen.findByRole('button', { name: /Link to/ }));

    const [, first] = screen.getAllByRole('row');

    expect(first?.textContent).toContain('Alien');
  });

  it('tells a withdrawn link apart from one that ran out and one that was used up', async () => {
    fetchShares.mockResolvedValue([
      share({ isRevoked: true, isSpent: true }),
      share({
        id: 'share-2',
        title: 'Expired Thing',
        expiresAt: '2020-01-01T00:00:00.000Z',
        isSpent: true,
      }),
      share({ id: 'share-3', title: 'Spent Thing', viewCap: 2, views: 2, isSpent: true }),
    ]);

    renderInACache(<SharePanel />);

    expect(await screen.findByText('Withdrawn')).toBeInTheDocument();
    expect(screen.getByText('Ran out')).toBeInTheDocument();
    expect(screen.getByText('All used up')).toBeInTheDocument();
  });

  it('says how far through its allowance a link is', async () => {
    fetchShares.mockResolvedValue([share({ viewCap: 5, views: 2 })]);

    renderInACache(<SharePanel />);

    expect(await screen.findByText('2 of 5 times')).toBeInTheDocument();
  });

  it('counts the openings of a link with no limit without inventing one', async () => {
    fetchShares.mockResolvedValue([share({ views: 3 })]);

    renderInACache(<SharePanel />);

    expect(await screen.findByText('3 times')).toBeInTheDocument();
  });

  it('says first that withdrawing takes anybody watching with it, then withdraws', async () => {
    fetchShares.mockResolvedValue([share()]);

    const user = userEvent.setup();

    renderInACache(<SharePanel />);

    await user.click(await screen.findByRole('button', { name: 'Withdraw the link to The Thing' }));

    expect(
      await screen.findByText(/including for anybody watching through it right now/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Withdraw it' }));

    await waitFor(() => {
      expect(revokeShare).toHaveBeenCalledWith('share-1');
    });
  });

  it('reads the links again once one has been withdrawn', async () => {
    fetchShares.mockResolvedValue([share()]);

    const user = userEvent.setup();

    renderInACache(<SharePanel />);

    await withdraw(user, 'The Thing');

    await waitFor(() => {
      expect(fetchShares).toHaveBeenCalledTimes(2);
    });
  });

  it('leaves a link alone where the confirmation is dismissed', async () => {
    fetchShares.mockResolvedValue([share()]);

    const user = userEvent.setup();

    renderInACache(<SharePanel />);

    await user.click(await screen.findByRole('button', { name: 'Withdraw the link to The Thing' }));
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Withdraw it' })).not.toBeInTheDocument();
    });

    expect(revokeShare).not.toHaveBeenCalled();
  });

  it('can be sorted by standing, so the ones still working can be read together', async () => {
    fetchShares.mockResolvedValue([
      share({ isRevoked: true, isSpent: true }),
      share({ id: 'share-2', title: 'Working Thing' }),
    ]);

    const user = userEvent.setup();

    renderInACache(<SharePanel />);

    await user.click(await screen.findByRole('button', { name: /Standing/ }));

    const [, first] = screen.getAllByRole('row');

    expect(first?.textContent).toContain('Working Thing');
  });

  it('can be sorted by how often a link has been opened, the busiest first', async () => {
    fetchShares.mockResolvedValue([
      share({ title: 'Quiet Thing', views: 1 }),
      share({ id: 'share-2', title: 'Busy Thing', views: 9 }),
    ]);

    const user = userEvent.setup();

    renderInACache(<SharePanel />);

    await user.click(await screen.findByRole('button', { name: /Opened/ }));

    const [, first] = screen.getAllByRole('row');

    expect(first?.textContent).toContain('Busy Thing');
  });

  it('offers no way to withdraw a link that has already ended', async () => {
    fetchShares.mockResolvedValue([share({ isRevoked: true, isSpent: true })]);

    renderInACache(<SharePanel />);

    expect(await screen.findByText('Withdrawn')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Withdraw the link to The Thing' }),
    ).not.toBeInTheDocument();
  });

  it('says plainly when nothing has been handed out', async () => {
    renderInACache(<SharePanel />);

    expect(await screen.findByText(/You have not handed out any links/)).toBeInTheDocument();
  });
});
