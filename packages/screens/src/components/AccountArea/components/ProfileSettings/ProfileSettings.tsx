import { Icon } from '@ValenceUI/Icon';
import { ArrowsClockwiseIcon, ImageSquareIcon } from '@phosphor-icons/react';
import { Button } from '@ValenceUI/Button';
import { FilePicker } from '@ValenceUI/FilePicker';
import { SettingRow } from '@ValenceUI/SettingRow';
import { TextField } from '@ValenceUI/TextField';
import { SegmentedRow } from '@ValenceUI/SegmentedRow';
import { useTheme } from '@ValenceClient/shell/useTheme';
import { readTheme } from '@ValenceClient/shell/theme';
import { Switch } from '@ValenceUI/Switch';
import { PROFILE_COLOURS, AVATAR_STYLES } from '@ValenceContracts/schemas/ViewerProfile';
import { STILL_WATCHING_OFF } from '@ValenceContracts/schemas/StillWatching';
import { ProfileFace } from '@ValenceScreens/components/ProfileFace/ProfileFace';
import type { ProfileSettingsProps } from './ProfileSettings.types';

const PHOTO_TYPES = 'image/jpeg,image/png,image/webp,image/avif,image/gif,video/webm,video/mp4';

const ASK_AFTER = [
  { id: 'off', label: 'Never' },
  { id: '2', label: '2' },
  { id: '3', label: '3' },
  { id: '4', label: '4' },
  { id: '6', label: '6' },
] as const;

const THEMES = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const;

/**
 * Everything about how somebody appears: their name, their picture, the colour behind it, and how
 * patient Valence is about asking whether they are still there.
 *
 * Nothing here writes. Every control changes a draft the dialog holds, and one button in the foot
 * commits the lot — because these are four facets of one profile rather than four settings, and
 * answering them one write at a time means a stranger can see half a change while somebody is still
 * making up their mind about the rest.
 *
 * The rows are handed out loose rather than in a list of their own, so that whoever is drawing the
 * panel can run one hairline down the whole of it instead of stacking several boxed groups.
 *
 * @param profile - The profile as the server holds it, or nothing while it is being read.
 * @param draft - The profile as it would be saved, or nothing while there is nothing to change.
 * @param onDraft - Told what somebody changed.
 */
const ProfileSettings = ({ profile, draft, onDraft }: ProfileSettingsProps) => {
  const { theme, choose } = useTheme();

  const isReady = profile !== null && draft !== null;
  const seed = profile?.id ?? 'valence';

  return (
    <>
      <SettingRow
        title="Display name"
        description="What everybody sharing this server sees when they pick who is watching."
      >
        <TextField
          label="Display name"
          isLabelHidden
          value={draft?.name ?? ''}
          onValueChange={(next) => {
            onDraft({ name: next });
          }}
          placeholder={profile?.name ?? 'Your name'}
          disabled={!isReady}
          isPill
          size="sm"
          className="w-56"
        />
      </SettingRow>

      <SettingRow
        title="Profile picture"
        description={
          draft?.photo === null || draft?.photo === undefined
            ? 'A photograph, one of the drawn faces, or the first letter of your name.'
            : `${draft.photo.name} — saved when you press Save.`
        }
      >
        {profile === null || draft === null ? null : (
          <ProfileFace
            profile={{ ...profile, name: draft.name, colour: draft.colour, avatar: draft.avatar }}
            pending={draft.photo}
            className="size-8 shrink-0 rounded-lg text-xs"
          />
        )}

        <FilePicker
          label="Upload a picture"
          accept={PHOTO_TYPES}
          disabled={!isReady}
          onPick={(file) => {
            onDraft({
              photo: file,
              avatar: { kind: 'photo', isVideo: file.type.startsWith('video/') },
            });
          }}
        >
          <span className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-accent/30 bg-accent/15 px-3.5 text-[0.8125rem] font-medium text-accent transition-colors hover:bg-accent/25">
            <Icon of={ImageSquareIcon} size={15} />
            Upload
          </span>
        </FilePicker>
      </SettingRow>

      <SettingRow
        title="Drawn face"
        description="Where you would rather not use a photograph, pick one of these instead."
      >
        {AVATAR_STYLES.map((style) => (
          <Button
            key={style}
            variant="bare"
            size="none"
            label={`Use the ${style} face`}
            isActive={draft?.avatar.kind === 'drawn' && draft.avatar.style === style}
            disabled={!isReady}
            className={`size-8 overflow-hidden rounded-lg bg-subtle transition-transform ${
              draft?.avatar.kind === 'drawn' && draft.avatar.style === style
                ? 'ring-2 ring-accent'
                : 'hover-hover:hover:scale-105'
            }`}
            onClick={() => {
              onDraft({ avatar: { kind: 'drawn', style, seed }, photo: null });
            }}
          >
            <img
              src={`/api/profiles/avatars/${style}?seed=${encodeURIComponent(seed)}`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </Button>
        ))}

        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          isPill
          label="Use your initial instead"
          disabled={!isReady}
          onClick={() => {
            onDraft({ avatar: { kind: 'initial' }, photo: null });
          }}
        >
          <Icon of={ArrowsClockwiseIcon} size={16} />
        </Button>
      </SettingRow>

      <SettingRow
        title="Theme"
        description="Kept on this device rather than on your account, and applied as soon as you choose it."
      >
        <SegmentedRow
          size="sm"
          tone="accent"
          label="Theme"
          value={theme}
          items={THEMES}
          onSelect={(chosen) => {
            choose(readTheme(chosen));
          }}
        />
      </SettingRow>

      <SettingRow
        title="Colour"
        description="The background behind your initial, and the tint on your drawn face."
      >
        {PROFILE_COLOURS.map((option) => (
          <Button
            key={option}
            variant="bare"
            size="none"
            label={`Use ${option}`}
            isActive={option === draft?.colour}
            disabled={!isReady}
            style={{ backgroundColor: option }}
            className={`size-6 rounded-full transition-transform ${
              option === draft?.colour
                ? 'ring-2 ring-accent ring-offset-2 ring-offset-[var(--color-surface-raised)]'
                : 'hover-hover:hover:scale-105'
            }`}
            onClick={() => {
              onDraft({ colour: option });
            }}
          />
        ))}
      </SettingRow>

      <SettingRow
        title="Ask if you are still watching"
        description="After this many episodes play by themselves, Valence checks before starting another."
      >
        <SegmentedRow
          size="sm"
          tone="accent"
          label="Ask if you are still watching"
          items={ASK_AFTER}
          value={
            draft === null || draft.askStillWatchingAfter === STILL_WATCHING_OFF
              ? 'off'
              : draft.askStillWatchingAfter.toString()
          }
          onSelect={(chosen) => {
            onDraft({
              askStillWatchingAfter: chosen === 'off' ? STILL_WATCHING_OFF : Number(chosen),
            });
          }}
        />
      </SettingRow>

      <SettingRow
        title="Show what I am watching on Discord"
        description="The title, and the series and episode where there is one, appear in your Discord status while something is playing. It needs Valence open on the same machine as Discord."
      >
        <Switch
          label="Show what I am watching on Discord"
          isLabelHidden
          isOn={draft?.showsWhatIamWatching ?? false}
          disabled={!isReady}
          onToggle={() => {
            onDraft({ showsWhatIamWatching: !(draft?.showsWhatIamWatching ?? false) });
          }}
        />
      </SettingRow>
    </>
  );
};

ProfileSettings.displayName = 'ProfileSettings';

export { ProfileSettings };
