import { useState } from 'react';
import { RiAddLine, RiCloseLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { AddTriggerDialog } from '@FluxWeb/components/AdminArea/components/AddTriggerDialog/AddTriggerDialog';
import { describeTrigger } from '@FluxWeb/admin/describeTrigger';
import type { ScheduleTrigger } from '@FluxWeb/admin/fetchAdmin';
import type { JobSchedulePageProps } from './JobSchedulePage.types';

/**
 * What makes one job run on its own, Jellyfin's scheduled-tasks page style — its own screen reached
 * by pressing into a job, rather than a control squeezed into its row in the list.
 */
const JobSchedulePage = ({ triggers, onAdd, onRemove }: JobSchedulePageProps) => {
  const [isAdding, setIsAdding] = useState(false);

  const add = (trigger: ScheduleTrigger) => {
    setIsAdding(false);
    onAdd(trigger);
  };

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
            <RiAddLine size={16} aria-hidden />
            Add trigger
          </Button>
        </div>

        {triggers.length === 0 ? (
          <p className="rounded-xl border border-[var(--surface-line)] px-4 py-3 text-sm text-text-muted">
            No triggers. This only runs when you press Run.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--surface-line)] overflow-hidden rounded-xl border border-[var(--surface-line)]">
            {triggers.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-text">{describeTrigger(entry.trigger)}</span>

                <Button
                  variant="ghost"
                  size="sm"
                  isPill
                  aria-label={`Remove ${describeTrigger(entry.trigger)}`}
                  onClick={() => {
                    onRemove(entry.id);
                  }}
                >
                  <RiCloseLine size={16} aria-hidden />
                </Button>
              </li>
            ))}
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
