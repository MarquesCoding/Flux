import { IconBell } from '@tabler/icons-react'
import PopoverPanelModule from '@FluxUI/PopoverPanel'

const { PopoverPanel } = PopoverPanelModule

/**
 * What has happened since somebody last looked.
 *
 * Nothing, so far, and it says so rather than being hidden until there is
 * something to show: a bell that appears only when it rings is a bell nobody
 * knows they have, and a viewer who has been told a server is quiet knows more
 * than one who was told nothing.
 *
 * The server does not raise anything yet. When it does — a library finished
 * scanning, a request granted, a download ready — this is where it arrives,
 * and everything but the list below stays as it is.
 */
const NotificationBell = () => (
  <PopoverPanel
    label="Notifications"
    side="bottom"
    heading="Notifications"
    trigger={<IconBell size={20} aria-hidden />}
  >
    <div className="flex w-64 flex-col gap-1 py-1">
      <p className="text-sm text-text">Nothing new.</p>
      <p className="text-xs text-text-muted">
        Finished scans and anything else worth interrupting you for will turn up here.
      </p>
    </div>
  </PopoverPanel>
)

NotificationBell.displayName = 'NotificationBell'

export default { NotificationBell }
