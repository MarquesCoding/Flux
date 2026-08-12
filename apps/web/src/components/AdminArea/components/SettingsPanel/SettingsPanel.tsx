import { useState } from 'react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { TextField } from '@FluxUI/TextField';
import { saveCatalogueKey } from '@FluxWeb/admin/fetchAdmin';
import type { SettingsPanelProps } from './SettingsPanel.types';

/**
 * What the instance is configured with, and who can sign into it.
 *
 * The key field and whether it is saving are held here rather than by the
 * admin area, because nothing outside this panel has any use for either.
 *
 * The field is emptied once a key is accepted. There is nowhere to read one
 * back from — the server keeps it and never returns it — so leaving what was
 * typed on screen would suggest it is still unsaved.
 */
const SettingsPanel = ({ overview, onCatalogueKeySaved }: SettingsPanelProps) => {
  const [catalogueKey, setCatalogueKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="grid gap-px bg-white/10 lg:grid-cols-2">
      <div className="flex flex-col gap-4 bg-surface/40 p-5">
        <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">Metadata catalogue</h2>

        <p className="text-sm text-text-muted">
          {overview?.settings.hasCatalogueKey === true
            ? 'A key is set. Entering a new one replaces it.'
            : 'Without a key, titles and years come from filenames alone.'}
        </p>

        <TextField
          label="Catalogue key"
          type="password"
          value={catalogueKey}
          onValueChange={setCatalogueKey}
          placeholder="Paste a key"
        />

        <div>
          <Button
            variant="glossy"
            size="sm"
            isPill
            isLoading={isSaving}
            disabled={catalogueKey === ''}
            onClick={() => {
              setIsSaving(true);

              void saveCatalogueKey(catalogueKey).then((saved) => {
                setIsSaving(false);

                if (saved) {
                  setCatalogueKey('');
                  onCatalogueKeySaved();
                }
              });
            }}
          >
            Save key
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-surface/40 p-5">
        <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">Accounts</h2>

        <ul className="flex flex-col divide-y divide-white/5 text-sm">
          {(overview?.users ?? []).map((account) => (
            <li key={account.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate text-text">{account.email}</span>

              {account.role === null ? null : <Badge size="sm">{account.role}</Badge>}
            </li>
          ))}
        </ul>

        <p className="text-xs leading-relaxed text-text-muted">
          {overview === null
            ? ''
            : `Cookies are ${
                overview.settings.cookieSecure ? 'secure' : 'not secure'
              }. Origins allowed to sign in: ${overview.settings.trustedOrigins.join(', ')}.`}
        </p>
      </div>
    </div>
  );
};

SettingsPanel.displayName = 'SettingsPanel';

export { SettingsPanel };
