import { useQuery } from '@tanstack/react-query';
import { Icon } from '@ValenceUI/Icon';
import { Alert02Icon, Cancel01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { HoverCard } from '@ValenceUI/HoverCard';
import { TabRow } from '@ValenceUI/TabRow';
import { Tabs } from '@ValenceUI/Tabs';
import { adminQueries } from '@ValenceClient/query/adminQueries';
import { sessionQueries } from '@ValenceClient/query/sessionQueries';
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
 * know. So is which version of Valence it is, which is the first thing anybody reporting a problem
 * with it is asked.
 *
 * The head is kept to a single line above the tabs. This is somewhere an operator works rather than
 * somewhere they arrive, and a banner-height head was room taken from every panel beneath it.
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
  const build = useQuery({ ...sessionQueries.version(), enabled: panel !== null });
  const version = build.data ?? null;

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
          size="compact"
          title="Server"
          detail={[
            ...(version === null ? [] : [`Valence ${version}`]),
            overview === null
              ? 'Reading the server…'
              : overview.transcoder.isReachable
                ? `Media service up · ${describeFfmpeg(overview.transcoder.ffmpegVersion)}`
                : 'Media service unreachable',
          ].join(' · ')}
          icon={
            overview?.transcoder.isReachable === true ? (
              <Icon of={CheckmarkCircle02Icon} size={16} className="text-accent" />
            ) : (
              <Icon of={Alert02Icon} size={16} className="text-danger" />
            )
          }
          below={
            <TabRow
              tone="underlined"
              size="sm"
              groups={ADMIN_SECTIONS.map((section) => ({
                ...(section.label === null ? {} : { label: section.label }),
                items: section.items,
              }))}
              label="What to look at"
              value={showing}
              className="-mx-5 px-5"
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
            <Icon of={Cancel01Icon} size={16} />
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
