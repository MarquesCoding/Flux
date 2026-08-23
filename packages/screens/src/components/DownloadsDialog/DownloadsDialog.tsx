import { Icon } from '@ValenceUI/Icon';
import { XIcon } from '@phosphor-icons/react';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { SettingList } from '@ValenceUI/SettingList';
import { SettingRow } from '@ValenceUI/SettingRow';
import { Switch } from '@ValenceUI/Switch';
import { useOfflineMode } from '@ValenceClient/offline/useOfflineMode';
import { DownloadList } from '@ValenceScreens/components/DownloadList/DownloadList';
import type { DownloadsDialogProps } from './DownloadsDialog.types';

/**
 * Everything this viewer has asked the server to prepare, raised over whatever they were looking at.
 *
 * Checking on a download is looking in on work rather than going somewhere: you glance at it, see
 * that the film you asked for an hour ago is ready, and carry on with what you were doing. Closing
 * it puts back the page underneath, which is what a glance should do.
 *
 * It exists only where files can be kept. See `canKeepFiles`. Which is also why going offline is
 * offered from here: a client that can hold nothing has nothing to be offline with, so the switch
 * belongs beside the things it would show.
 *
 * @param isOpen - Whether the address has it open.
 * @param onClose - Told it was dismissed.
 */
const DownloadsDialog = ({ isOpen, onClose }: DownloadsDialogProps) => {
  const { isByChoice, goOffline } = useOfflineMode();

  return (
    <Dialog label="Downloads" isOpen={isOpen} onClose={onClose}>
      <DialogTitle
        title="Downloads"
        detail="Once one is on this device it is yours until you delete it."
      >
        <Button variant="ghost" size="sm" isIconOnly isPill label="Close" onClick={onClose}>
          <Icon of={XIcon} size={16} />
        </Button>
      </DialogTitle>

      <DialogContent className="px-0">
        <SettingList>
          <SettingRow
            title="Go offline"
            description="Show only what is on this device. Worth turning on before you lose the connection rather than after."
          >
            <Switch
              isOn={isByChoice}
              label="Go offline"
              isLabelHidden
              onToggle={() => {
                goOffline(!isByChoice);
              }}
            />
          </SettingRow>
        </SettingList>

        <DownloadList />
      </DialogContent>
    </Dialog>
  );
};

DownloadsDialog.displayName = 'DownloadsDialog';

export { DownloadsDialog };
