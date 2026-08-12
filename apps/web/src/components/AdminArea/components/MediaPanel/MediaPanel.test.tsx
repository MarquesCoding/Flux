import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MediaPanel } from './MediaPanel';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const item = (overrides: Partial<MediaSummary> = {}): MediaSummary => ({
  id: 'item-1',
  libraryId: 'library-1',
  title: 'Parasite',
  year: 2019,
  durationSeconds: 7920,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
  seriesTitle: null,
  seasonNumber: null,
  episodeNumber: null,
  ...overrides,
});

const props = {
  media: [],
  onCorrect: vi.fn(),
  onRebuildArtefacts: vi.fn().mockResolvedValue(true),
};

describe('MediaPanel', () => {
  it('lists what the libraries hold', () => {
    render(<MediaPanel {...props} media={[item()]} />);

    expect(screen.getByText('Parasite')).toBeInTheDocument();
  });

  it('names a series by its programme, with the episode standing for it said quietly', () => {
    render(<MediaPanel {...props} media={[item({ title: 'Long Day', seriesTitle: 'From' })]} />);

    const row = screen.getByRole('row', { name: /From/ });

    expect(within(row).getByText('From')).toBeInTheDocument();
    expect(within(row).getByText('Long Day')).toBeInTheDocument();
  });

  it('says which is a film and which is a series, since a correction differs by kind', () => {
    render(<MediaPanel {...props} media={[item()]} />);

    expect(screen.getByText(/Film/)).toBeInTheDocument();
  });

  it('narrows to what was searched for', async () => {
    const user = userEvent.setup();

    render(<MediaPanel {...props} media={[item(), item({ id: 'item-2', title: 'Heat' })]} />);

    await user.type(screen.getByLabelText('Find a programme or film'), 'heat');

    expect(screen.getByText('Heat')).toBeInTheDocument();
    expect(screen.queryByText('Parasite')).not.toBeInTheDocument();
  });

  it('says nothing matched, rather than looking like an empty library', async () => {
    const user = userEvent.setup();

    render(<MediaPanel {...props} media={[item()]} />);

    await user.type(screen.getByLabelText('Find a programme or film'), 'zzz');

    expect(screen.getByText(/Nothing here matches that/)).toBeInTheDocument();
  });

  it('tells an empty library apart from one it could not read', () => {
    const { rerender } = render(<MediaPanel {...props} />);

    expect(screen.getByText(/Nothing has been scanned yet/)).toBeInTheDocument();

    rerender(<MediaPanel {...props} isUnreachable />);

    expect(screen.getByText(/could not be read from the server/)).toBeInTheDocument();
  });

  it('asks for the item whose match is wrong', async () => {
    const onCorrect = vi.fn();
    const user = userEvent.setup();

    render(<MediaPanel {...props} media={[item()]} onCorrect={onCorrect} />);

    await user.click(screen.getByRole('button', { name: /Wrong match/ }));

    expect(onCorrect).toHaveBeenCalledWith(item());
  });

  it('can be sorted by name, so a long list can be read down', async () => {
    const user = userEvent.setup();

    render(
      <MediaPanel
        {...props}
        media={[item({ id: 'z', title: 'Zodiac' }), item({ id: 'a', title: 'Alien' })]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Title/ }));

    const [, first] = screen.getAllByRole('row');

    expect(first?.textContent).toContain('Alien');
  });

  it('says which are films and which are series, since a wrong match differs by kind', () => {
    render(<MediaPanel {...props} media={[item()]} />);

    expect(screen.getByRole('columnheader', { name: /Kind/ })).toBeInTheDocument();
  });

  it('shows which items have no artwork, since that is what a bad match looks like', () => {
    render(<MediaPanel {...props} media={[item({ hasPoster: false })]} />);

    expect(screen.getByText('Missing')).toBeInTheDocument();
  });

  it('offers to rebuild one item, for the case where a single preview is wrong', async () => {
    const onRebuildArtefacts = vi.fn().mockResolvedValue(true);

    render(<MediaPanel {...props} media={[item()]} onRebuildArtefacts={onRebuildArtefacts} />);

    await userEvent.click(screen.getByRole('button', { name: /Rebuild previews/ }));

    expect(onRebuildArtefacts).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
  });

  it('says it will rebuild rather than that it has, because nothing is made yet', async () => {
    render(<MediaPanel {...props} media={[item()]} />);

    await userEvent.click(screen.getByRole('button', { name: /Rebuild previews/ }));

    expect(await screen.findByRole('button', { name: /Will rebuild/ })).toBeInTheDocument();
  });

  it('leaves the offer standing when the server would not do it', async () => {
    render(
      <MediaPanel
        {...props}
        media={[item()]}
        onRebuildArtefacts={vi.fn().mockResolvedValue(false)}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Rebuild previews/ }));

    expect(await screen.findByRole('button', { name: /Rebuild previews/ })).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(MediaPanel.displayName).toBe('MediaPanel');
  });
});
