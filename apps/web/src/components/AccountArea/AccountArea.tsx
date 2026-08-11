import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { IconLogout, IconPencil, IconShieldLock, IconUser } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { Badge } from '@FluxUI/Badge';
import { TabBar } from '@FluxUI/TabBar';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { fetchProfiles } from '@FluxWeb/profiles/fetchProfiles';
import { ProfileFace } from '@FluxWeb/components/ProfileFace/ProfileFace';
import { ProfileEditor } from '@FluxWeb/components/ProfilePicker/components/ProfileEditor/ProfileEditor';
import { TwoFactorSetup } from '@FluxWeb/components/TwoFactorSetup/TwoFactorSetup';
import { PasskeySetup } from '@FluxWeb/components/PasskeySetup/PasskeySetup';
import { DeviceList } from '@FluxWeb/components/AccountArea/components/DeviceList/DeviceList';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';
import type { AccountAreaProps } from './AccountArea.types';

const PANELS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'devices', label: 'Devices' },
] as const;

type PanelId = (typeof PANELS)[number]['id'];

/**
 * A person's own account.
 *
 * Two things live here and they are genuinely different questions: how you
 * appear to everybody sharing this server, and how you get in. Putting them
 * in one column would mean scrolling past a password field to change a
 * picture.
 *
 * The face is the same one on the way-in wall, shown at the size it is
 * actually chosen at, because the whole point of picking a colour or a
 * portrait is what it looks like there.
 */
const AccountArea = ({ user, onChanged, onSignOut }: AccountAreaProps) => {
  const [profile, setProfile] = useState<ViewerProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [panel, setPanel] = useState<PanelId>('profile');
  const prefersReducedMotion = useReducedMotion();

  const read = () => {
    void fetchProfiles().then((profiles) => {
      setProfile(profiles[0] ?? null);
    });
  };

  useEffect(read, []);

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 pb-16 pt-14 sm:px-10"
    >
      <motion.header
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion, 'heavy')}
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div className="flex items-center gap-5">
          {profile === null ? (
            <span className="size-20 shrink-0 rounded-3xl bg-white/5 sm:size-24" />
          ) : (
            <ProfileFace
              profile={profile}
              className="size-20 shrink-0 rounded-3xl text-3xl shadow-xl sm:size-24"
            />
          )}

          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              {profile?.name ?? user.name}
            </h1>

            <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              {user.email}
              {user.role !== 'admin' ? null : <Badge size="sm">admin</Badge>}
            </p>
          </div>
        </div>

        <TabBar
          tabs={[...PANELS]}
          selectedId={panel}
          onSelect={(id) => {
            const found = PANELS.find((candidate) => candidate.id === id);

            if (found !== undefined) {
              setPanel(found.id);
            }
          }}
          label="What to change"
        />
      </motion.header>

      {panel !== 'profile' ? null : (
        <motion.section
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
          aria-label="Profile"
          className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
        >
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-text-muted">
              <IconUser size={14} aria-hidden />
              How you appear
            </h2>

            {isEditing || profile === null ? null : (
              <Button
                variant="secondary"
                size="sm"
                isPill
                onClick={() => {
                  setIsEditing(true);
                }}
              >
                <IconPencil size={16} aria-hidden />
                Change
              </Button>
            )}
          </header>

          {profile === null ? (
            <p className="text-sm text-text-muted">Reading your profile…</p>
          ) : isEditing ? (
            <ProfileEditor
              profile={profile}
              onSaved={() => {
                setIsEditing(false);
                read();
                onChanged();
              }}
              onCancel={() => {
                setIsEditing(false);
              }}
            />
          ) : (
            <p className="max-w-prose text-sm leading-relaxed text-text-muted">
              This is the name and face everybody sharing this server sees when they pick who is
              watching. Changing it changes nothing about how you sign in.
            </p>
          )}
        </motion.section>
      )}

      {panel !== 'devices' ? null : (
        <motion.section
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
          aria-label="Devices"
          className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
        >
          <DeviceList />
        </motion.section>
      )}

      {panel !== 'security' ? null : (
        <motion.section
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
          aria-label="Security"
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-text-muted">
              <IconShieldLock size={14} aria-hidden />
              Getting in
            </h2>

            <TwoFactorSetup isEnabled={user.twoFactorEnabled === true} onChanged={onChanged} />
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <PasskeySetup onChanged={onChanged} />
          </div>
        </motion.section>
      )}

      <motion.footer
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6"
      >
        <p className="text-xs text-text-muted">
          Signing out returns to the wall of faces. Nothing about what you have watched is lost.
        </p>

        <Button variant="ghost" size="sm" isPill onClick={onSignOut}>
          <IconLogout size={16} aria-hidden />
          Sign out
        </Button>
      </motion.footer>
    </motion.div>
  );
};

AccountArea.displayName = 'AccountArea';

export { AccountArea };
