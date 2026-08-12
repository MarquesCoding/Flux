import { useState } from 'react';
import { Button } from '@FluxUI/Button';
import { TextField } from '@FluxUI/TextField';
import { saveCatalogueKey } from '@FluxWeb/admin/fetchAdmin';
import { Card } from '@FluxUI/Card';
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
    <div className="grid gap-4 lg:grid-cols-2">
      <Card as="section" padding="md" className="flex flex-col gap-5">
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
      </Card>

      <Card as="section" padding="md" className="flex flex-col gap-5">
        <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">Signing in</h2>

        <p className="text-xs leading-relaxed text-text-muted">
          {overview === null
            ? ''
            : `Cookies are ${
                overview.settings.cookieSecure ? 'secure' : 'not secure'
              }. Origins allowed to sign in: ${overview.settings.trustedOrigins.join(', ')}.`}
        </p>
      </Card>
    </div>
  );
};

SettingsPanel.displayName = 'SettingsPanel';

export { SettingsPanel };
