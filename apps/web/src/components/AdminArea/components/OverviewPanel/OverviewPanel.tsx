import {
  IconAlertTriangle,
  IconChevronRight,
  IconCircleCheck,
  IconInfoCircle,
} from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { collectConcerns } from '@FluxWeb/components/AdminArea/collectConcerns';
import type { ConcernTone } from '@FluxWeb/components/AdminArea/collectConcerns';
import type { OverviewPanelProps } from './OverviewPanel.types';

/**
 * Three levels, drawn from the tokens that exist.
 *
 * There is no warning colour in the palette, and inventing one here would be
 * a design decision smuggled into a refactor. Full-strength text against
 * muted is enough to separate "needs a person" from "not finished setting
 * up", and only what is actually broken takes the danger colour.
 */
const TONE_CLASSES: Record<ConcernTone, string> = {
  broken: 'text-danger',
  attention: 'text-text',
  setup: 'text-text-muted',
};

const toneIcon = (tone: ConcernTone) =>
  tone === 'setup' ? (
    <IconInfoCircle size={18} aria-hidden />
  ) : (
    <IconAlertTriangle size={18} aria-hidden />
  );

/**
 * Whether anything needs a person, and a way straight to it.
 *
 * The one question an operator opens this page to ask, which until now meant
 * visiting four panels and assembling the answer. Everything shown is already
 * somewhere else; what is new is that it is in one place and in order.
 *
 * A server with nothing wrong says so plainly rather than showing an empty
 * list, because "nothing here" and "nothing loaded" look identical otherwise.
 */
const OverviewPanel = ({
  overview,
  monitor,
  libraries,
  sessionCount,
  onOpenPanel,
}: OverviewPanelProps) => {
  const concerns = collectConcerns({ overview, monitor, libraries });

  return (
    <div className="flex flex-col">
      <header className="border-b border-white/10 px-5 py-3">
        <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">Needs attention</h2>
      </header>

      {concerns.length === 0 ? (
        <div className="flex items-start gap-3 p-5">
          <IconCircleCheck size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />

          <div className="flex flex-col gap-1">
            <p className="text-sm text-text">Nothing needs attention.</p>

            <p className="text-sm text-text-muted">
              {sessionCount === 0
                ? 'Nobody is watching anything right now.'
                : sessionCount === 1
                  ? 'One person is watching.'
                  : `${sessionCount.toString()} people are watching.`}
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {concerns.map((concern) => (
            <li key={concern.id}>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-3 rounded-none px-5 py-4 text-left"
                onClick={() => {
                  onOpenPanel(concern.panel);
                }}
              >
                <span className={`mt-0.5 shrink-0 ${TONE_CLASSES[concern.tone]}`}>
                  {toneIcon(concern.tone)}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm text-text">{concern.title}</span>
                  <span className="truncate text-xs text-text-muted">{concern.detail}</span>
                </span>

                <IconChevronRight size={16} className="shrink-0 text-text-muted" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

OverviewPanel.displayName = 'OverviewPanel';

export { OverviewPanel };
