import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from './SettingsPanel';
import type { AdminOverview } from '@FluxWeb/admin/fetchAdmin';

const saveCatalogueKey = vi.hoisted(() => vi.fn());

vi.mock('@FluxWeb/admin/fetchAdmin', () => ({ saveCatalogueKey }));

const overview = (overrides: Partial<AdminOverview['settings']> = {}): AdminOverview => ({
  users: [{ id: 'usr_1', name: 'Dan', email: 'dan@flux.local', role: 'admin', createdAt: '' }],
  settings: {
    hasCatalogueKey: false,
    cookieSecure: false,
    trustedOrigins: ['http://localhost:8420'],
    ...overrides,
  },
  transcoder: {
    isReachable: true,
    address: 'unix:/tmp/flux-transcoder.sock',
    ffmpegVersion: null,
    hardwareAccels: [],
    rejectedEncoders: [],
  },
  library: { itemCount: 0, libraryCount: 0 },
});

describe('SettingsPanel', () => {
  beforeEach(() => {
    saveCatalogueKey.mockReset();
    saveCatalogueKey.mockResolvedValue(true);
  });

  it('says what happens without a key', () => {
    render(<SettingsPanel overview={overview()} onCatalogueKeySaved={vi.fn()} />);

    expect(screen.getByText(/come from filenames alone/)).toBeInTheDocument();
  });

  it('says a key is set without showing it', () => {
    render(
      <SettingsPanel
        overview={overview({ hasCatalogueKey: true })}
        onCatalogueKeySaved={vi.fn()}
      />,
    );

    expect(screen.getByText(/A key is set/)).toBeInTheDocument();
    expect(screen.getByLabelText('Catalogue key')).toHaveValue('');
  });

  it('will not save nothing', () => {
    render(<SettingsPanel overview={overview()} onCatalogueKeySaved={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Save key' })).toBeDisabled();
  });

  it('saves what was typed', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel overview={overview()} onCatalogueKeySaved={vi.fn()} />);

    await user.type(screen.getByLabelText('Catalogue key'), 'a-key');
    await user.click(screen.getByRole('button', { name: 'Save key' }));

    expect(saveCatalogueKey).toHaveBeenCalledWith('a-key');
  });

  it('empties the field once accepted, since there is nowhere to read one back from', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel overview={overview()} onCatalogueKeySaved={vi.fn()} />);

    await user.type(screen.getByLabelText('Catalogue key'), 'a-key');
    await user.click(screen.getByRole('button', { name: 'Save key' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Catalogue key')).toHaveValue('');
    });
  });

  it('asks for the overview again, having changed something it does not own', async () => {
    const onCatalogueKeySaved = vi.fn();
    const user = userEvent.setup();
    render(<SettingsPanel overview={overview()} onCatalogueKeySaved={onCatalogueKeySaved} />);

    await user.type(screen.getByLabelText('Catalogue key'), 'a-key');
    await user.click(screen.getByRole('button', { name: 'Save key' }));

    await waitFor(() => {
      expect(onCatalogueKeySaved).toHaveBeenCalled();
    });
  });

  it('keeps what was typed when the server refused it', async () => {
    saveCatalogueKey.mockResolvedValue(false);

    const onCatalogueKeySaved = vi.fn();
    const user = userEvent.setup();
    render(<SettingsPanel overview={overview()} onCatalogueKeySaved={onCatalogueKeySaved} />);

    await user.type(screen.getByLabelText('Catalogue key'), 'a-key');
    await user.click(screen.getByRole('button', { name: 'Save key' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Catalogue key')).toHaveValue('a-key');
    });

    expect(onCatalogueKeySaved).not.toHaveBeenCalled();
  });

  it('lists who can sign in', () => {
    render(<SettingsPanel overview={overview()} onCatalogueKeySaved={vi.fn()} />);

    expect(screen.getByText('dan@flux.local')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('says nothing about the server before it has answered', () => {
    render(<SettingsPanel overview={null} onCatalogueKeySaved={vi.fn()} />);

    expect(screen.queryByText(/Cookies are/)).not.toBeInTheDocument();
  });

  it('reports how sign-in is configured', () => {
    render(
      <SettingsPanel overview={overview({ cookieSecure: true })} onCatalogueKeySaved={vi.fn()} />,
    );

    expect(screen.getByText(/Cookies are secure/)).toBeInTheDocument();
    expect(screen.getByText(/localhost:8420/)).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SettingsPanel.displayName).toBe('SettingsPanel');
  });
});
