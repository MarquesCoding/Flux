import { Icon } from '@ValenceUI/Icon';
import { CaretUpDownIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { Badge } from '@ValenceUI/Badge';
import { SettingList } from '@ValenceUI/SettingList';
import { SettingRow } from '@ValenceUI/SettingRow';
import { OptionMenu } from '@ValenceUI/OptionMenu';
import { TextField } from '@ValenceUI/TextField';
import { saveCatalogueKey, saveHardwareAccel } from '@ValenceClient/admin/fetchAdmin';
import { accelerationOptions } from '@ValenceScreens/components/AdminArea/accelerationOptions';
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
    <SettingList>
      <SettingRow
        title="Hardware acceleration"
        description="Valence picks whichever backend the machine proves it can use. Choose one to insist, which also uses an encoder that failed that check — for when the check is wrong and the card plainly works."
      >
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

              <Icon of={CaretUpDownIcon} size={15} className="shrink-0" />
            </>
          }
          triggerShape="field"
          align="end"
          className="w-44"
        />
      </SettingRow>

      <SettingRow
        title="Metadata catalogue"
        description={
          overview?.settings.hasCatalogueKey === true
            ? 'A key is set. Entering a new one replaces it.'
            : 'Without a key, titles and years come from filenames alone.'
        }
      >
        <TextField
          label="Catalogue key"
          isLabelHidden
          type="password"
          value={catalogueKey}
          onValueChange={setCatalogueKey}
          placeholder="Paste a key"
          isPill
          size="sm"
          className="w-48"
        />

        <Button
          variant="soft"
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
          Save
        </Button>
      </SettingRow>

      <SettingRow
        title="Signing in"
        description={
          overview === null
            ? ''
            : `Origins allowed to sign in: ${overview.settings.trustedOrigins.join(', ')}.`
        }
      >
        {overview === null ? null : (
          <Badge tone={overview.settings.cookieSecure ? 'success' : 'warning'}>
            {overview.settings.cookieSecure ? 'secure' : 'not secure'}
          </Badge>
        )}
      </SettingRow>
    </SettingList>
  );
};

SettingsPanel.displayName = 'SettingsPanel';

export { SettingsPanel };
