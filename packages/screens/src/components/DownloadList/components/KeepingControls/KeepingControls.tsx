import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  DeviceMobileIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { Icon } from '@ValenceUI/Icon';
import { ProgressBar } from '@ValenceUI/ProgressBar';
import { keptFraction } from '@ValenceCore/functions/describeKeeping';
import { dropAFile, keepAFile, pauseAFile } from '@ValenceClient/downloads/keepingFiles';
import type { KeepingControlsProps } from './KeepingControls.types';

/**
 * What can be done about the copy of a prepared download on this machine.
 *
 * The server having prepared something and this machine having a copy of it are two different
 * facts, and the row shows both because somebody clearing space cares about the difference. Letting
 * go here is about this disk only; the server goes on holding its own copy for the other devices,
 * and is told to stop separately.
 *
 * @param download - What the server prepared.
 * @param held - The copy on this machine, where there is one.
 */
const KeepingControls = ({ download, held }: KeepingControlsProps) => {
  if (held === null) {
    return (
      <Button
        variant="soft"
        size="sm"
        isPill
        onClick={() => {
          void keepAFile(download);
        }}
      >
        <Icon of={DeviceMobileIcon} size={15} />
        Keep on this device
      </Button>
    );
  }

  if (held.state === 'here') {
    return (
      <>
        <Badge size="sm" tone="success">
          <Icon of={CheckCircleIcon} size={14} />
          On this device
        </Badge>

        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          isPill
          label={`Remove ${download.title} from this device`}
          onClick={() => {
            void dropAFile(download.id);
          }}
        >
          <Icon of={TrashIcon} size={16} />
        </Button>
      </>
    );
  }

  if (held.state === 'failed') {
    return (
      <Button
        variant="soft"
        size="sm"
        isPill
        onClick={() => {
          void pauseAFile(download.id, false);
        }}
      >
        <Icon of={ArrowClockwiseIcon} size={15} />
        Try again
      </Button>
    );
  }

  return (
    <>
      {held.state !== 'fetching' ? null : (
        <ProgressBar
          value={keptFraction(held) ?? 0}
          label={`Fetching ${download.title} to this device`}
          className="w-28"
        />
      )}

      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        isPill
        label={
          held.state === 'paused'
            ? `Carry on fetching ${download.title}`
            : `Stop fetching ${download.title} for now`
        }
        onClick={() => {
          void pauseAFile(download.id, held.state !== 'paused');
        }}
      >
        <Icon of={held.state === 'paused' ? PlayIcon : PauseIcon} size={16} />
      </Button>
    </>
  );
};

KeepingControls.displayName = 'KeepingControls';

export { KeepingControls };
