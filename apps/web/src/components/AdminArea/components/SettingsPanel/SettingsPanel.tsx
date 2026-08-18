import { Icon } from '@FluxUI/Icon';
import { UnfoldMoreIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import { OptionMenu } from '@FluxUI/OptionMenu';
import { TextField } from '@FluxUI/TextField';
import { saveCatalogueKey, saveHardwareAccel } from '@FluxClient/admin/fetchAdmin';
import { accelerationOptions } from '@FluxWeb/components/AdminArea/accelerationOptions';
import type { SettingsPanelProps } from './SettingsPanel.types';

/**
 * What this server is configured with and who may sign into it: the metadata catalogue key, which
 * encoder transcodes use, and the accounts on the server. Each setting says what it means in
 * practice rather than only what it is set to, since most of them are invisible until something is
 * slow or a title comes out wrong.
 *
 * @param overview - What the server reports about itself, or null before it has answered.
 * @param onCatalogueKeySaved - Called once a catalogue key has been written.
 * @param onHardwareAccelSaved - Called once the encoder choice has been written.
 */
const SettingsPanel = ({
  overview,
  onCatalogueKeySaved,
  onHardwareAccelSaved,
}: SettingsPanelProps) => {
  const [catalogueKey, setCatalogueKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [accel, setAccel] = useState(overview?.settings.hardwareAccel ?? '');

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card as="section" padding="none" className="flex flex-col">
        <CardHeader title="Hardware acceleration" />

        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-text-muted">
            Flux picks whichever backend the machine proves it can use. Choose one here to insist,
            which also uses an encoder that failed that check — for when the check is wrong and the
            card plainly works. Software encoding stays available either way.
          </p>

          <OptionMenu
            label="Hardware acceleration"
            groups={[
              {
                name: 'Backend',
                selectedId: accel,
                onSelect: (id) => {
                  setAccel(id);

                  void saveHardwareAccel(id).then((saved) => {
                    if (saved) {
                      onHardwareAccelSaved();
                    }
                  });
                },
                options: accelerationOptions,
              },
            ]}
            trigger={
              <>
                <span className="truncate">
                  {accelerationOptions.find((option) => option.id === accel)?.label ?? 'Automatic'}
                </span>

                <Icon of={UnfoldMoreIcon} size={15} className="shrink-0 text-text-muted" />
              </>
            }
            triggerShape="field"
            align="start"
            matchTriggerWidth
          />
        </div>
      </Card>

      <Card as="section" padding="none" className="flex flex-col">
        <CardHeader title="Metadata catalogue" />

        <div className="flex flex-col gap-4 p-4">
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
              variant="primary"
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
      </Card>

      <Card as="section" padding="none" className="flex flex-col">
        <CardHeader title="Signing in" />

        <p className="p-4 text-sm leading-relaxed text-text-muted">
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
