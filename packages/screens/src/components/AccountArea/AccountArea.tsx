import { motion } from 'motion/react';
import { ApiKeyPanel } from '@ValenceScreens/components/ApiKeyPanel/ApiKeyPanel';
import { HistoryPanel } from '@ValenceScreens/components/HistoryPanel/HistoryPanel';
import { useTravelDirection } from '@ValenceUI/useTravelDirection';
import { ACCOUNT_PANELS } from '@ValenceScreens/components/AccountArea/accountPanels';
import { SettingList } from '@ValenceUI/SettingList';
import { TabPanel } from '@ValenceUI/TabPanel';
import { staggerVariants } from '@ValenceUI/animations/reveal';
import { ProfileSettings } from '@ValenceScreens/components/AccountArea/components/ProfileSettings/ProfileSettings';
import { TwoFactorSetup } from '@ValenceScreens/components/TwoFactorSetup/TwoFactorSetup';
import { PasskeySetup } from '@ValenceScreens/components/PasskeySetup/PasskeySetup';
import { DeviceList } from '@ValenceScreens/components/AccountArea/components/DeviceList/DeviceList';
import { SharePanel } from '@ValenceScreens/components/AccountArea/components/SharePanel/SharePanel';
import type { AccountAreaProps } from './AccountArea.types';

const PANEL_ORDER = ACCOUNT_PANELS.map((one) => one.id);

/**
 * Somebody's own account: their name and password, the devices they are signed in on, their passkeys
 * and second factor, their API keys, the links they have handed out, and their viewing history.
 *
 * @param user - Whose account it is.
 * @param panel - Which panel is showing, which decides the side a panel arrives from.
 * @param profile - The profile as the server holds it.
 * @param draft - The profile as it would be saved.
 * @param onDraft - Told what somebody changed about it.
 * @param onChanged - Told when something changed, so the shell can read the account again.
 */
const AccountArea = ({ user, panel, profile, draft, onDraft, onChanged }: AccountAreaProps) => {
  const travel = useTravelDirection(PANEL_ORDER, panel);

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      className="flex w-full flex-col"
    >
      <TabPanel value="profile" className="flex flex-col gap-6" travel={travel}>
        <SettingList>
          <ProfileSettings profile={profile} draft={draft} onDraft={onDraft} />
        </SettingList>
      </TabPanel>

      <TabPanel value="devices" travel={travel}>
        <DeviceList />
      </TabPanel>

      <TabPanel value="links" travel={travel}>
        <SharePanel />
      </TabPanel>

      <TabPanel value="history" className="flex flex-col gap-6" travel={travel}>
        <HistoryPanel />
      </TabPanel>

      <TabPanel value="security" className="flex flex-col gap-6" travel={travel}>
        <SettingList>
          <TwoFactorSetup isEnabled={user.twoFactorEnabled === true} onChanged={onChanged} />

          <PasskeySetup onChanged={onChanged} />
        </SettingList>

        <ApiKeyPanel />
      </TabPanel>
    </motion.div>
  );
};

AccountArea.displayName = 'AccountArea';

export { AccountArea };
