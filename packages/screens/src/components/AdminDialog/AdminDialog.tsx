import { useQuery } from '@tanstack/react-query';
import { Icon } from '@ValenceUI/Icon';
import { CheckCircleIcon, WarningIcon, XIcon } from '@phosphor-icons/react';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { HoverCard } from '@ValenceUI/HoverCard';
import { TabRow } from '@ValenceUI/TabRow';
import { Tabs } from '@ValenceUI/Tabs';
import { adminQueries } from '@ValenceClient/query/adminQueries';
import { AdminArea } from '@ValenceScreens/components/AdminArea/AdminArea';
import { ADMIN_PANELS, ADMIN_SECTIONS } from '@ValenceScreens/components/AdminArea/adminSections';
import { describeAcceleration } from '@ValenceScreens/components/AdminArea/describeAcceleration';
import { describeFfmpeg } from '@ValenceScreens/components/AdminArea/describeFfmpeg';
import type { AdminDialogProps } from './AdminDialog.types';

/**
 * The server as the person running it sees it, raised over whatever they were looking at rather
 * than taking them somewhere else. Running a server is something you look in on and come back from,
 * which is a dialog rather than a destination — closing it puts back the page underneath instead of
 * leaving somebody to find their way back to what they were watching.
 *
 * Whether the media service is up is said in the head, beside the title, because it is true of the
 * whole dialog rather than of any one panel and it is the first thing anybody opening this wants to
 * know.
 *
 * Which panel is open, and which job's schedule within it, are in the address, so a particular one
 * can be linked to and the back button moves between them.
 *
 * @param panel - Which panel the address names, or nothing where the dialog is shut.
 * @param job - The job whose schedule the address names.
 * @param onPanel - Told which panel to move to.
 * @param onJob - Told which job's schedule to open, or nothing on going back.
 * @param onClose - Told it was dismissed.
 */
const AdminDialog = ({ panel, job, onPanel, onJob, onClose }: AdminDialogProps) => {
  const asked = useQuery({ ...adminQueries.overview(), enabled: panel !== null });
  const overview = asked.data ?? null;

  const acceleration =
    overview === null
      ? null
      : describeAcceleration(overview.settings.hardwareAccel, overview.transcoder.hardwareAccels);
  const showing = ADMIN_PANELS.find((one) => one.id === panel)?.id ?? 'overview';

  return (
    <Dialog
      label="The server"
      isOpen={panel !== null}
      onClose={onClose}
      size="stage"
      className="sm:w-[min(78rem,94vw)]"
    >
      <Tabs value={showing} onValueChange={onPanel}>
        <DialogTitle
          className="gap-5 pb-0"
          title="Server"
          detail={
            overview === null
              ? 'Reading the server…'
              : overview.transcoder.isReachable
                ? `Media service up · ${describeFfmpeg(overview.transcoder.ffmpegVersion)}`
                : 'Media service unreachable'
          }
          icon={
            overview?.transcoder.isReachable === true ? (
              <Icon of={CheckCircleIcon} size={22} className="text-accent" />
            ) : (
              <Icon of={WarningIcon} size={22} className="text-danger" />
            )
          }
          below={
            <TabRow
              tone="underlined"
              groups={ADMIN_SECTIONS.map((section) => ({
                ...(section.label === null ? {} : { label: section.label }),
                items: section.items,
              }))}
              label="What to look at"
              value={showing}
              className="-mx-6 px-6"
            />
          }
        >
          {acceleration === null ? null : (
            <HoverCard
              side="bottom"
              align="center"
              detail={<p className="max-w-xs text-xs leading-relaxed">{acceleration.detail}</p>}
            >
              <span>
                <Badge size="sm" tone={acceleration.tone}>
                  {acceleration.label}
                </Badge>
              </span>
            </HoverCard>
          )}

          <Button variant="ghost" size="sm" isIconOnly isPill label="Close" onClick={onClose}>
            <Icon of={XIcon} size={16} />
          </Button>
        </DialogTitle>

        <DialogContent>
          <AdminArea panel={showing} onPanel={onPanel} initialJob={job} onJobChange={onJob} />
        </DialogContent>
      </Tabs>
    </Dialog>
  );
};

AdminDialog.displayName = 'AdminDialog';

export { AdminDialog };
