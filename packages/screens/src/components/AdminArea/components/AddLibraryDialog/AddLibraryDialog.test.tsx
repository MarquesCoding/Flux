import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddLibraryDialog } from './AddLibraryDialog';
import type { Library } from '@ValenceContracts/schemas/Library';

const createLibraryMock = vi.hoisted(() => vi.fn());
const fetchFoldersMock = vi.hoisted(() => vi.fn());

vi.mock('@ValenceClient/admin/fetchFolders', () => ({ fetchFolders: fetchFoldersMock }));

vi.mock('@ValenceClient/library/fetchLibrary', () => ({
  createLibrary: createLibraryMock,
}));

const films: Library = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  name: 'Films',
  kind: 'movies',
  path: '/media/films',
  itemCount: 0,
  lastScannedAt: null,

  defaultAudioLanguage: null,

  filesAtOnce: null,
};

beforeEach(() => {
  createLibraryMock.mockReset();
  createLibraryMock.mockResolvedValue(films);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const fillForm = async (actor: ReturnType<typeof userEvent.setup>) => {
  await actor.type(screen.getByLabelText('Name'), 'Films');
  await actor.type(screen.getByLabelText('Path'), '/media/films');
};

describe('AddLibraryDialog', () => {
  it('fills the path with a folder found by browsing the server', async () => {
    const actor = userEvent.setup();

    fetchFoldersMock.mockImplementation((path: string | null) =>
      Promise.resolve(
        path === null
          ? {
              path: null,
              parent: null,
              folders: [{ name: '/media', path: '/media' }],
              isTruncated: false,
            }
          : { path, parent: '/', folders: [], isTruncated: false },
      ),
    );

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AddLibraryDialog isOpen onClose={vi.fn()} onCreated={vi.fn()} />
      </QueryClientProvider>,
    );

    await actor.click(screen.getByRole('button', { name: 'Browse' }));
    await actor.click(await screen.findByRole('button', { name: '/media' }));
    await screen.findByText('No folders in here.');
    await actor.click(screen.getByRole('button', { name: 'Use this folder' }));

    expect(screen.getByLabelText('Path')).toHaveValue('/media');
    expect(screen.queryByRole('button', { name: 'Use this folder' })).not.toBeInTheDocument();
  });

  it('is hidden when closed', () => {
    render(<AddLibraryDialog isOpen={false} onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.queryByLabelText('Add a library')).not.toBeInTheDocument();
  });

  it('defaults to a movies library', () => {
    render(<AddLibraryDialog isOpen onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Movies' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not offer music, which would scan to nothing for ever', () => {
    render(<AddLibraryDialog isOpen onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Music' })).not.toBeInTheDocument();
  });

  it('switches kind on request', async () => {
    const actor = userEvent.setup();
    render(<AddLibraryDialog isOpen onClose={vi.fn()} onCreated={vi.fn()} />);

    await actor.click(screen.getByRole('button', { name: 'Shows' }));

    expect(screen.getByRole('button', { name: 'Shows' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Movies' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('rejects an empty submission', async () => {
    const actor = userEvent.setup();
    render(<AddLibraryDialog isOpen onClose={vi.fn()} onCreated={vi.fn()} />);

    await actor.click(screen.getByRole('button', { name: 'Add library' }));

    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(createLibraryMock).not.toHaveBeenCalled();
  });

  it('creates the library and reports it', async () => {
    const onCreated = vi.fn();
    const actor = userEvent.setup();
    render(<AddLibraryDialog isOpen onClose={vi.fn()} onCreated={onCreated} />);

    await fillForm(actor);
    await actor.click(screen.getByRole('button', { name: 'Add library' }));

    await waitFor(() => {
      expect(createLibraryMock).toHaveBeenCalledWith({
        name: 'Films',
        kind: 'movies',
        path: '/media/films',
      });
    });

    expect(onCreated).toHaveBeenCalledWith(films);
  });

  it('shows the server error and keeps the dialog open', async () => {
    createLibraryMock.mockRejectedValue(new Error('The path is not a readable directory.'));
    const onCreated = vi.fn();
    const actor = userEvent.setup();
    render(<AddLibraryDialog isOpen onClose={vi.fn()} onCreated={onCreated} />);

    await fillForm(actor);
    await actor.click(screen.getByRole('button', { name: 'Add library' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('not a readable directory');
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('resets the form on cancel', async () => {
    const actor = userEvent.setup();
    render(<AddLibraryDialog isOpen onClose={vi.fn()} onCreated={vi.fn()} />);

    await fillForm(actor);
    await actor.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByLabelText('Name')).toHaveValue('');
  });
});
