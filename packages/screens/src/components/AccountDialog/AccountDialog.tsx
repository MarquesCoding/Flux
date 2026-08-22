import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@ValenceUI/Icon';
import { SignOutIcon, XIcon } from '@phosphor-icons/react';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { TabRow } from '@ValenceUI/TabRow';
import { Tabs } from '@ValenceUI/Tabs';
import { notify } from '@ValenceUI/notify';
import { profileQueries } from '@ValenceClient/query/profileQueries';
import { sessionQueries } from '@ValenceClient/query/sessionQueries';
import { AccountArea } from '@ValenceScreens/components/AccountArea/AccountArea';
import { ACCOUNT_PANELS } from '@ValenceScreens/components/AccountArea/accountPanels';
import { ProfileFace } from '@ValenceScreens/components/ProfileFace/ProfileFace';
import { signOut } from '@ValenceClient/session/auth';
import { saveProfile, uploadProfilePhoto } from '@ValenceClient/profiles/fetchProfiles';
import { usePlace } from '@ValenceScreens/navigation/usePlace';
import { useShell } from '@ValenceClient/shell/useShell';
import type { ViewerProfile } from '@ValenceContracts/schemas/ViewerProfile';
import type { ProfileDraft } from '@ValenceScreens/components/AccountArea/components/ProfileSettings/ProfileSettings.types';
import type { AccountDialogProps } from './AccountDialog.types';

/**
 * Reads a profile as a draft of itself, which is what every control in the dialog changes until
 * somebody presses Save.
 *
 * @param profile - The profile as the server holds it.
 * @returns The same thing, with nothing uploaded yet.
 */
const draftOf = (profile: ViewerProfile): ProfileDraft => ({
  name: profile.name,
  colour: profile.colour,
  avatar: profile.avatar,
  askStillWatchingAfter: profile.askStillWatchingAfter,
  showsWhatIamWatching: profile.showsWhatIamWatching,
  photo: null,
});

/**
 * Somebody's own account, raised over whatever they were looking at rather than taking them
 * somewhere else. An account is something you adjust and return from, which is a dialog rather than
 * a destination: closing it puts back the page underneath instead of leaving somebody to find their
 * way back to it.
 *
 * Who the account belongs to is said once, in the head, rather than again at the top of the first
 * panel. The head is the one part of a dialog that does not scroll away, which makes it the right
 * place for whose account this is and for moving between the panels.
 *
 * Which panel is open is in the address, so a particular one can be linked to and the back button
 * moves between them.
 *
 * Signing out empties the cache rather than only asking who is signed in again. Everything held
 * there belongs to the person leaving — what they kept, how far through things they are, what is
 * waiting on their bell — and handing that to whoever signs in next is a privacy fault, not a stale
 * read.
 *
 * @param panel - Which panel the address names, or nothing where the dialog is shut.
 * @param onPanel - Told which panel to move to.
 * @param onClose - Told it was dismissed.
 */
const AccountDialog = ({ panel, onPanel, onClose }: AccountDialogProps) => {
  const { user, refresh } = useShell();
  const { go } = usePlace();
  const cache = useQueryClient();

  const asked = useQuery({ ...profileQueries.watching(), enabled: panel !== null });
  const profile = asked.data ?? null;

  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(profile === null ? null : draftOf(profile));
  }, [profile]);

  const isChanged =
    profile !== null &&
    draft !== null &&
    (draft.photo !== null ||
      draft.name.trim() !== profile.name ||
      draft.colour !== profile.colour ||
      draft.askStillWatchingAfter !== profile.askStillWatchingAfter ||
      draft.showsWhatIamWatching !== profile.showsWhatIamWatching ||
      JSON.stringify(draft.avatar) !== JSON.stringify(profile.avatar));

  const save = async () => {
    if (profile === null || draft === null) {
      return;
    }

    setIsSaving(true);

    const sent = draft.photo === null || (await uploadProfilePhoto(profile.id, draft.photo));

    const saved =
      sent &&
      (await saveProfile(
        profile.id,
        draft.name.trim() === '' ? profile.name : draft.name.trim(),
        draft.colour,
        draft.avatar,
        draft.askStillWatchingAfter,
        draft.showsWhatIamWatching,
      ));

    setIsSaving(false);

    if (!saved) {
      notify.failed('Those changes were not saved.');

      return;
    }

    await cache.invalidateQueries({ queryKey: profileQueries.key });
    await cache.invalidateQueries({ queryKey: sessionQueries.key });
    await refresh();
  };

  const showing = ACCOUNT_PANELS.find((one) => one.id === panel)?.id ?? 'profile';

  return (
    <Dialog label="Your account" isOpen={panel !== null} onClose={onClose} size="stage">
      <Tabs
        value={showing}
        onValueChange={(next) => {
          const found = ACCOUNT_PANELS.find((one) => one.id === next);

          if (found !== undefined) {
            onPanel(found.id);
          }
        }}
      >
        <DialogTitle
          className="gap-5 pb-0"
          title={profile?.name ?? user.name}
          detail={user.email}
          icon={
            profile === null ? (
              <span className="size-12 shrink-0 rounded-xl bg-white/5" />
            ) : (
              <ProfileFace profile={profile} className="size-12 shrink-0 rounded-xl text-lg" />
            )
          }
          below={
            <TabRow
              tone="underlined"
              groups={[{ items: ACCOUNT_PANELS }]}
              value={showing}
              label="What to change"
              className="-mx-6 px-6"
            />
          }
        >
          {user.role !== 'admin' ? null : <Badge size="sm">admin</Badge>}

          <Button variant="ghost" size="sm" isIconOnly isPill label="Close" onClick={onClose}>
            <Icon of={XIcon} size={16} />
          </Button>
        </DialogTitle>

        <DialogContent>
          <AccountArea
            user={user}
            panel={showing}
            profile={profile}
            draft={draft}
            onDraft={(change) => {
              setDraft((was) => (was === null ? was : { ...was, ...change }));
            }}
            onChanged={() => {
              void refresh();
            }}
          />
        </DialogContent>

        <DialogFooter>
          <Button
            variant="danger"
            isPill
            onClick={() => {
              void signOut().then(async (ended) => {
                if (!ended) {
                  notify.failed('You are still signed in. The server would not end the session.');

                  return;
                }

                cache.clear();
                onClose();
                go({ section: 'home', search: '', inspecting: null, playing: null, account: null });

                return refresh();
              });
            }}
          >
            <Icon of={SignOutIcon} size={16} />
            Sign out
          </Button>

          <Button
            variant="primary"
            isPill
            isLoading={isSaving}
            disabled={!isChanged}
            onClick={() => {
              void save();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </Tabs>
    </Dialog>
  );
};

AccountDialog.displayName = 'AccountDialog';

export { AccountDialog };
