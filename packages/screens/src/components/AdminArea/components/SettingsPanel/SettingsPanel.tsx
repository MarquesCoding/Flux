import { Icon } from '@ValenceUI/Icon';
import { UnfoldMoreIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { Badge } from '@ValenceUI/Badge';
import { SettingList } from '@ValenceUI/SettingList';
import { SettingRow } from '@ValenceUI/SettingRow';
import { OptionMenu } from '@ValenceUI/OptionMenu';
import { SegmentedRow } from '@ValenceUI/SegmentedRow';
import { TextField } from '@ValenceUI/TextField';
import { Switch } from '@ValenceUI/Switch';
import {
  saveCatalogueKey,
  saveHardwareAccel,
  savePreviewQuality,
  saveShowsProfilesBeforeSignIn,
} from '@ValenceClient/admin/fetchAdmin';
import { PreviewQualitySchema } from '@ValenceContracts/schemas/PreviewQuality';
import { accelerationOptions } from '@ValenceScreens/components/AdminArea/accelerationOptions';
import type { SettingsPanelProps } from './SettingsPanel.types';

const PREVIEW_QUALITY_CHOICES = [
  { id: 'low', label: 'Low' },
  { id: 'standard', label: 'Standard' },
  { id: 'high', label: 'High' },
] as const;
import { PanelCard } from '@ValenceScreens/components/PanelCard/PanelCard';

/**
 * What this server is configured with and who may sign into it: the metadata catalogue key, which
 * encoder transcodes use, how good the hover previews are, and the accounts on the server. Each setting says what it means in
 * practice rather than only what it is set to, since most of them are invisible until something is
 * slow or a title comes out wrong.
 *
 * @param overview - What the server reports about itself, or null before it has answered.
 * @param onCatalogueKeySaved - Called once a catalogue key has been written.
 * @param onHardwareAccelSaved - Called once the encoder choice has been written.
 * @param onPreviewQualitySaved - Called once the preview preset has been written.
 * @param onProfileVisibilitySaved - Called once the choice about showing the faces has been written.
 */
const SettingsPanel = ({
  overview,
  onCatalogueKeySaved,
  onHardwareAccelSaved,
  onPreviewQualitySaved,
  onProfileVisibilitySaved,
}: SettingsPanelProps) => {
  const [catalogueKey, setCatalogueKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [accel, setAccel] = useState(overview?.settings.hardwareAccel ?? '');
  const [quality, setQuality] = useState(overview?.settings.previewQuality ?? 'high');
  const [showsFaces, setShowsFaces] = useState(
    overview?.settings.showsProfilesBeforeSignIn ?? false,
  );

  return (
    <PanelCard title="Settings" isFlush>
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

                <Icon of={UnfoldMoreIcon} size={15} className="shrink-0" />
              </>
            }
            triggerShape="field"
            align="end"
            className="w-44"
          />
        </SettingRow>

        <SettingRow
          title="Preview quality"
          description="Smaller clips take less room and less time to make; sharper ones hold up across the hero. Changing it makes every preview again in the background."
        >
          <SegmentedRow
            label="Preview quality"
            size="sm"
            tone="accent"
            items={PREVIEW_QUALITY_CHOICES}
            value={quality}
            onSelect={(id) => {
              const chosen = PreviewQualitySchema.safeParse(id);

              if (!chosen.success) {
                return;
              }

              setQuality(chosen.data);

              void savePreviewQuality(chosen.data).then((saved) => {
                if (saved) {
                  onPreviewQualitySaved();
                }
              });
            }}
          />
        </SettingRow>

        <SettingRow
          title="Show who lives here"
          description="Draws the household's faces on the way in, so somebody signs in by picking one. Off, the way in asks for an address and a password instead, and nobody who has not signed in can read the names, pictures or identifiers of the people here."
        >
          <Switch
            label="Show who lives here"
            isLabelHidden
            isOn={showsFaces}
            onToggle={() => {
              const next = !showsFaces;

              setShowsFaces(next);

              void saveShowsProfilesBeforeSignIn(next).then((saved) => {
                if (saved) {
                  onProfileVisibilitySaved();

                  return;
                }

                setShowsFaces(!next);
              });
            }}
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
    </PanelCard>
  );
};

SettingsPanel.displayName = 'SettingsPanel';

export { SettingsPanel };
