import { RiAlertLine, RiArrowRightSLine, RiInformationLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import type { ConcernTone } from '@FluxWeb/components/AdminArea/collectConcerns';
import type { ConcernsBannerProps } from './ConcernsBanner.types';

/**
 * Three levels, drawn from the tokens that exist.
 *
 * There is no warning colour in the palette, and inventing one here would be
 * a design decision smuggled into a refactor. Full-strength text against muted
 * is enough to separate "needs a person" from "not finished setting up", and
 * only what is actually broken takes the danger colour.
 */
const TONE_CLASSES: Record<ConcernTone, string> = {
  broken: 'text-danger',
  attention: 'text-text',
  setup: 'text-text-muted',
};

/**
 * What needs a person, above everything else.
 *
 * Kept at the top of the admin area rather than inside the overview, because
 * something broken is worth knowing about while reading the jobs list or the
 * accounts table just as much — and an operator who has to visit one section
 * to learn that another is on fire will find out too late.
 *
 * Draws nothing at all when nothing is wrong. This is the one place in the
 * page allowed to disappear: a permanent green "all is well" is a row of
 * furniture people stop reading, which is exactly the row you need them to
 * notice on the day it changes.
 */
const ConcernsBanner = ({ concerns, onOpenPanel }: ConcernsBannerProps) => {
  if (concerns.length === 0) {
    return null;
  }

  return (
    <Card as="section" padding="sm" className="flex flex-col">
      <ul className="flex flex-col">
        {concerns.map((concern) => (
          <li key={concern.id}>
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-3 rounded-md px-3 py-2.5 text-left"
              onClick={() => {
                onOpenPanel(concern.panel);
              }}
            >
              <span className={`mt-0.5 shrink-0 ${TONE_CLASSES[concern.tone]}`}>
                {concern.tone === 'setup' ? (
                  <RiInformationLine size={16} aria-hidden />
                ) : (
                  <RiAlertLine size={16} aria-hidden />
                )}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-text">{concern.title}</span>
                <span className="truncate text-xs text-text-muted">{concern.detail}</span>
              </span>

              <RiArrowRightSLine size={14} className="shrink-0 text-text-muted" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
};

ConcernsBanner.displayName = 'ConcernsBanner';

export { ConcernsBanner };
