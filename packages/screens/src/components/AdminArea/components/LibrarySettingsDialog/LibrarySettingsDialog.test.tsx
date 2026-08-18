import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibrarySettingsDialog } from './LibrarySettingsDialog';
import type { Library } from '@FluxContracts/schemas/Library';

const updateLibraryMock = vi.hoisted(() => vi.fn());

vi.mock('@FluxClient/library/fetchLibrary', () => ({
  updateLibrary: updateLibraryMock,
}));

const films = (overrides: Partial<Library> = {}): Library => ({
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  name: 'Films',
  kind: 'movies',
  path: '/media/films',
  itemCount: 3,
  lastScannedAt: null,
  defaultAudioLanguage: null,
  filesAtOnce: null,
  ...overrides,
});

beforeEach(() => {
  updateLibraryMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LibrarySettingsDialog', () => {
  it('renders nothing without a library', () => {
    render(
      <LibrarySettingsDialog
        library={null}
        isOpen
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('is hidden when closed', () => {
    render(
      <LibrarySettingsDialog
        library={films()}
        isOpen={false}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Films settings')).not.toBeInTheDocument();
  });

  it("shows each file's own default when no language is forced", () => {
    render(
      <LibrarySettingsDialog
        library={films()}
        isOpen
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );

    expect(screen.getByText("Each file's own default")).toBeInTheDocument();
  });

  it('pins the detected browser language to the top of the list', async () => {
    const actor = userEvent.setup();
    render(
      <LibrarySettingsDialog
        library={films()}
        isOpen
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );

    await actor.click(screen.getByRole('button', { name: 'Force default audio track' }));

    expect(await screen.findByText('Your browser')).toBeInTheDocument();
  });

  it('saves without confirming when the library has no items yet', async () => {
    updateLibraryMock.mockResolvedValue(films({ itemCount: 0, defaultAudioLanguage: 'de' }));
    const onUpdated = vi.fn();
    const onClose = vi.fn();
    const onRegenerate = vi.fn();
    const actor = userEvent.setup();
    render(
      <LibrarySettingsDialog
        library={films({ itemCount: 0 })}
        isOpen
        onClose={onClose}
        onUpdated={onUpdated}
        onRegenerate={onRegenerate}
      />,
    );

    await actor.click(screen.getByRole('button', { name: 'Force default audio track' }));
    await actor.click(await screen.findByRole('menuitemradio', { name: 'Deutsch' }));
    await actor.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateLibraryMock).toHaveBeenCalledWith(films().id, {
        defaultAudioLanguage: 'de',
        filesAtOnce: null,
      });
    });

    expect(onUpdated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  it('saves without confirming when the language did not change', async () => {
    updateLibraryMock.mockResolvedValue(films());
    const onUpdated = vi.fn();
    const onRegenerate = vi.fn();
    const actor = userEvent.setup();
    render(
      <LibrarySettingsDialog
        library={films()}
        isOpen
        onClose={vi.fn()}
        onUpdated={onUpdated}
        onRegenerate={onRegenerate}
      />,
    );

    await actor.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalled();
    });

    expect(onRegenerate).not.toHaveBeenCalled();
  });

  it('asks before regenerating previews for a library with existing items', async () => {
    updateLibraryMock.mockResolvedValue(films({ defaultAudioLanguage: 'de' }));
    const onUpdated = vi.fn();
    const actor = userEvent.setup();
    render(
      <LibrarySettingsDialog
        library={films()}
        isOpen
        onClose={vi.fn()}
        onUpdated={onUpdated}
        onRegenerate={vi.fn()}
      />,
    );

    await actor.click(screen.getByRole('button', { name: 'Force default audio track' }));
    await actor.click(await screen.findByRole('menuitemradio', { name: 'Deutsch' }));
    await actor.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/preview generation task/)).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('finishes without regenerating when told not now', async () => {
    updateLibraryMock.mockResolvedValue(films({ defaultAudioLanguage: 'de' }));
    const onUpdated = vi.fn();
    const onClose = vi.fn();
    const onRegenerate = vi.fn();
    const actor = userEvent.setup();
    render(
      <LibrarySettingsDialog
        library={films()}
        isOpen
        onClose={onClose}
        onUpdated={onUpdated}
        onRegenerate={onRegenerate}
      />,
    );

    await actor.click(screen.getByRole('button', { name: 'Force default audio track' }));
    await actor.click(await screen.findByRole('menuitemradio', { name: 'Deutsch' }));
    await actor.click(screen.getByRole('button', { name: 'Save' }));
    await actor.click(await screen.findByRole('button', { name: 'Not now' }));

    expect(onUpdated).toHaveBeenCalledWith(films({ defaultAudioLanguage: 'de' }));
    expect(onClose).toHaveBeenCalled();
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  it('hands regeneration to the caller and closes immediately, rather than blocking on it', async () => {
    updateLibraryMock.mockResolvedValue(films({ defaultAudioLanguage: 'de' }));
    const onUpdated = vi.fn();
    const onClose = vi.fn();
    const onRegenerate = vi.fn();
    const actor = userEvent.setup();
    render(
      <LibrarySettingsDialog
        library={films()}
        isOpen
        onClose={onClose}
        onUpdated={onUpdated}
        onRegenerate={onRegenerate}
      />,
    );

    await actor.click(screen.getByRole('button', { name: 'Force default audio track' }));
    await actor.click(await screen.findByRole('menuitemradio', { name: 'Deutsch' }));
    await actor.click(screen.getByRole('button', { name: 'Save' }));
    await actor.click(await screen.findByRole('button', { name: 'Regenerate previews' }));

    expect(onRegenerate).toHaveBeenCalledWith(films().id);
    expect(onUpdated).toHaveBeenCalledWith(films({ defaultAudioLanguage: 'de' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the server error and keeps the dialog open', async () => {
    updateLibraryMock.mockRejectedValue(new Error('No such library.'));
    const onUpdated = vi.fn();
    const actor = userEvent.setup();
    render(
      <LibrarySettingsDialog
        library={films()}
        isOpen
        onClose={vi.fn()}
        onUpdated={onUpdated}
        onRegenerate={vi.fn()}
      />,
    );

    await actor.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No such library.');
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(LibrarySettingsDialog.displayName).toBe('LibrarySettingsDialog');
  });

  it('asks for one file at a time when a library is told to', async () => {
    const user = userEvent.setup();

    updateLibraryMock.mockResolvedValue(films({ filesAtOnce: 1 }));

    render(
      <LibrarySettingsDialog
        library={films()}
        isOpen
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Files at once/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: /One at a time/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateLibraryMock).toHaveBeenCalledWith(
        films().id,
        expect.objectContaining({ filesAtOnce: 1 }),
      );
    });
  });

  it('leaves it to the server unless somebody says otherwise', async () => {
    const user = userEvent.setup();

    updateLibraryMock.mockResolvedValue(films());

    render(
      <LibrarySettingsDialog
        library={films()}
        isOpen
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateLibraryMock).toHaveBeenCalledWith(
        films().id,
        expect.objectContaining({ filesAtOnce: null }),
      );
    });
  });

  it('opens showing what the library is already set to', () => {
    render(
      <LibrarySettingsDialog
        library={films({ filesAtOnce: 1 })}
        isOpen
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Files at once/ })).toHaveTextContent(
      'One at a time',
    );
  });
});
