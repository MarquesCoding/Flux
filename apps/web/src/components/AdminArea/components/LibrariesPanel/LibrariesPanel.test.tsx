import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LibrariesPanel } from './LibrariesPanel';
import type { Library } from '@FluxContracts/schemas/Library';
import type { ScanEntry } from '@FluxWeb/components/AdminArea/scanCoordinator';

const library = (overrides: Partial<Library> = {}): Library => ({
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  name: 'Films',
  kind: 'movies',
  path: '/media/films',
  itemCount: 4,
  lastScannedAt: null,
  defaultAudioLanguage: null,
  ...overrides,
});

const scanning = (overrides: Partial<ScanEntry> = {}): ScanEntry =>
  ({
    kind: 'scan',
    phase: 'probing',
    processed: 1,
    total: 10,
    ...overrides,
  }) satisfies ScanEntry;

const props = {
  libraries: [],
  progress: new Map<string, ScanEntry>(),
  isScanningAll: false,
  isResettingAll: false,
  onScan: vi.fn(),
  onScanAll: vi.fn(),
  onResetAll: vi.fn(),
  onRegeneratePreviews: vi.fn(),
  onLibraryCreated: vi.fn(),
  onLibraryUpdated: vi.fn(),
};

describe('LibrariesPanel', () => {
  it('tells somebody not to add a library when the list simply could not be read', () => {
    render(<LibrariesPanel {...props} isUnreachable />);

    expect(screen.getByText(/could not be read from the server/)).toBeInTheDocument();
    expect(screen.queryByText(/No libraries yet/)).not.toBeInTheDocument();
  });

  it('says what to do when there are none', () => {
    render(<LibrariesPanel {...props} />);

    expect(screen.getByText(/No libraries yet/)).toBeInTheDocument();
  });

  it('shows a library with where it reads from and how much is in it', () => {
    render(<LibrariesPanel {...props} libraries={[library()]} />);

    expect(screen.getByText('Films')).toBeInTheDocument();
    expect(screen.getByText(/\/media\/films · 4 items/)).toBeInTheDocument();
  });

  it('counts one item without saying "1 items"', () => {
    render(<LibrariesPanel {...props} libraries={[library({ itemCount: 1 })]} />);

    expect(screen.getByText(/1 item$/)).toBeInTheDocument();
  });

  it('scans one library on request', async () => {
    const onScan = vi.fn();
    const user = userEvent.setup();
    render(<LibrariesPanel {...props} libraries={[library()]} onScan={onScan} />);

    await user.click(screen.getByRole('button', { name: /^Scan$/ }));

    expect(onScan).toHaveBeenCalledWith(library().id);
  });

  it('shows progress in place of the scan button while one is running', () => {
    render(
      <LibrariesPanel
        {...props}
        libraries={[library()]}
        progress={new Map([[library().id, scanning()]])}
      />,
    );

    expect(screen.queryByRole('button', { name: /^Scan$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /Scanning Films/ })).toBeInTheDocument();
  });

  it('says which of the two jobs is running, since both show a bar', () => {
    render(
      <LibrariesPanel
        {...props}
        libraries={[library()]}
        progress={new Map([[library().id, scanning({ kind: 'regeneratePreviews' })]])}
      />,
    );

    expect(
      screen.getByRole('progressbar', { name: /Regenerating previews for Films/ }),
    ).toBeInTheDocument();
  });

  it('names a job it picked up from the server, which the queue names differently', () => {
    render(
      <LibrariesPanel
        {...props}
        libraries={[library()]}
        progress={new Map([[library().id, scanning({ kind: 'library.scan' })]])}
      />,
    );

    expect(screen.getByRole('progressbar', { name: /Scanning Films/ })).toBeInTheDocument();
  });

  it('offers to read every file again, not only the ones that changed', () => {
    render(<LibrariesPanel {...props} libraries={[library()]} />);

    expect(screen.getByRole('button', { name: /Read every file again/ })).toBeInTheDocument();
  });

  it('forces the read when asked to read again', async () => {
    const onScan = vi.fn();
    const user = userEvent.setup();

    render(<LibrariesPanel {...props} libraries={[library()]} onScan={onScan} />);

    await user.click(screen.getByRole('button', { name: /Read every file again/ }));

    expect(onScan).toHaveBeenCalledWith(library().id, true);
  });

  describe('acting on everything at once', () => {
    it('is refused when there are no libraries to act on', () => {
      render(<LibrariesPanel {...props} />);

      expect(screen.getByRole('button', { name: /Scan all libraries/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Reset and rebuild/ })).toBeDisabled();
    });

    it('is refused while any one library is already scanning', () => {
      render(
        <LibrariesPanel
          {...props}
          libraries={[library()]}
          progress={new Map([[library().id, scanning()]])}
        />,
      );

      expect(screen.getByRole('button', { name: /Scan all libraries/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Reset and rebuild/ })).toBeDisabled();
    });

    it('scans everything when nothing is in the way', async () => {
      const onScanAll = vi.fn();
      const user = userEvent.setup();
      render(<LibrariesPanel {...props} libraries={[library()]} onScanAll={onScanAll} />);

      await user.click(screen.getByRole('button', { name: /Scan all libraries/ }));

      expect(onScanAll).toHaveBeenCalled();
    });

    it('asks before rebuilding, rather than doing it on the press', async () => {
      const onResetAll = vi.fn();
      const user = userEvent.setup();
      render(<LibrariesPanel {...props} libraries={[library()]} onResetAll={onResetAll} />);

      await user.click(screen.getByRole('button', { name: /Reset and rebuild/ }));

      expect(onResetAll).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(LibrariesPanel.displayName).toBe('LibrariesPanel');
  });
});
