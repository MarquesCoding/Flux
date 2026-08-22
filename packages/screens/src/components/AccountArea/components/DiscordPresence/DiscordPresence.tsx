import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@ValenceUI/Card';
import { CardHeader } from '@ValenceUI/CardHeader';
import { Switch } from '@ValenceUI/Switch';
import { saveProfile } from '@ValenceClient/profiles/fetchProfiles';
import { profileQueries } from '@ValenceClient/query/profileQueries';
import type { DiscordPresenceProps } from './DiscordPresence.types';

/**
 * Whether the title somebody is watching appears in their Discord status.
 *
 * The profile this changes is the one currently watching rather than the first on the account, since
 * that is the one the player reads when it decides whether to say anything. On an account several
 * people share, the setting belongs to whoever picked their face, not to whoever the list happens to
 * begin with.
 *
 * The switch writes as soon as it is flipped rather than waiting for a save, because a card holding
 * one setting has nothing to save alongside it, and a switch that has visibly moved reads as already
 * done. A refused write puts it back where it was and says so.
 *
 * @param onChanged - Told once the change has been written, so the shell can read the account again.
 */
const DiscordPresence = ({ onChanged }: DiscordPresenceProps) => {
  const asked = useQuery(profileQueries.watching());
  const [wanted, setWanted] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [wasRefused, setWasRefused] = useState(false);

  const profile = asked.data ?? null;
  const isOn = wanted ?? profile?.showsWhatIamWatching ?? false;

  const toggle = async () => {
    if (profile === null) {
      return;
    }

    const next = !isOn;

    setWanted(next);
    setIsSaving(true);
    setWasRefused(false);

    const saved = await saveProfile(
      profile.id,
      profile.name,
      profile.colour,
      profile.avatar,
      profile.askStillWatchingAfter,
      next,
    );

    setIsSaving(false);

    if (saved) {
      onChanged();
      return;
    }

    setWanted(!next);
    setWasRefused(true);
  };

  return (
    <Card as="section" padding="none" className="flex flex-col">
      <CardHeader title="What you are watching" />

      <div className="flex flex-col gap-3 p-4">
        <p className="max-w-prose text-sm leading-relaxed text-text-muted">
          The title, and the series and episode where there is one, appear in your Discord status
          while something is playing — visible to anybody who can see your profile. It needs Valence
          open on the same machine as Discord, and it shows nothing at all when nothing is playing.
        </p>

        <Switch
          label="Show what I am watching on Discord"
          isOn={isOn}
          disabled={profile === null || isSaving}
          onToggle={() => {
            void toggle();
          }}
        />

        {wasRefused ? (
          <p className="text-xs text-text-muted">That could not be saved. Try again.</p>
        ) : null}
      </div>
    </Card>
  );
};

DiscordPresence.displayName = 'DiscordPresence';

export { DiscordPresence };
