import { Icon } from '@ValenceUI/Icon';
import { PlusIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { AddTriggerDialog } from '@ValenceScreens/components/AdminArea/components/AddTriggerDialog/AddTriggerDialog';
import { describeTrigger } from '@ValenceClient/admin/describeTrigger';
import { describeTriggerInZone } from '@ValenceClient/admin/describeTriggerInZone';
import type { ScheduleTrigger } from '@ValenceClient/admin/fetchAdmin';
import type { JobSchedulePageProps } from './JobSchedulePage.types';

/**
 * What makes one job run on its own: the triggers set against it, a way to add another, and a way to
 * remove one. Its own screen reached by pressing into a job rather than a control squeezed into that
 * job's row, since a job may have any number of triggers and a row has space for none of them.
 *
 * @param triggers - What currently makes this job run.
 * @param onAdd - Called with a trigger to add.
 * @param onRemove - Called with the trigger to remove.
 */
const JobSchedulePage = ({ triggers, onAdd, onRemove, timezone = null }: JobSchedulePageProps) => {
  const [isAdding, setIsAdding] = useState(false);

  const add = (trigger: ScheduleTrigger) => {
    setIsAdding(false);
    onAdd(trigger);
  };

  const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs uppercase tracking-[0.16em] text-text-muted">Triggers</h3>

          <Button
            variant="ghost"
            size="sm"
            isPill
            onClick={() => {
              setIsAdding(true);
            }}
          >
            <Icon of={PlusIcon} size={16} />
            Add trigger
          </Button>
        </div>

        {timezone === null ? null : (
          <p className="text-xs text-text-muted">
            {timezone === viewerZone
              ? `Times are ${timezone}, the same clock you are reading this on.`
              : `Times are ${timezone}. You are reading this in ${viewerZone}.`}
          </p>
        )}

        {triggers.length === 0 ? (
          <p className="rounded-lg border border-[var(--surface-line)] px-4 py-3 text-sm text-text-muted">
            No triggers. This only runs when you press Run.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--surface-line)] overflow-hidden rounded-lg border border-[var(--surface-line)]">
            {triggers.map((entry) => {
              const elsewhere =
                timezone === null
                  ? null
                  : describeTriggerInZone({
                      trigger: entry.trigger,
                      serverZone: timezone,
                      viewerZone,
                      now,
                    });

              return (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm text-text">{describeTrigger(entry.trigger)}</span>

                    {elsewhere === null ? null : (
                      <span className="text-xs text-text-muted">{elsewhere}</span>
                    )}
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    isPill
                    aria-label={`Remove ${describeTrigger(entry.trigger)}`}
                    onClick={() => {
                      onRemove(entry.id);
                    }}
                  >
                    <Icon of={XIcon} size={16} />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AddTriggerDialog
        isOpen={isAdding}
        onAdd={add}
        onClose={() => {
          setIsAdding(false);
        }}
      />
    </div>
  );
};

JobSchedulePage.displayName = 'JobSchedulePage';

export { JobSchedulePage };
