import { Icon } from '@FluxUI/Icon';
import { Alert02Icon, ArrowRight01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import type { ConcernTone } from '@FluxWeb/components/AdminArea/collectConcerns';
import type { ConcernsBannerProps } from './ConcernsBanner.types';

const TONE_CLASSES: Record<ConcernTone, string> = {
  broken: 'text-danger',
  attention: 'text-text',
  setup: 'text-text-muted',
};

/**
 * What needs a person, above everything else on the admin page. Each concern is pressable and opens
 * the panel it can be dealt with in, so being told about a problem and getting to it are one gesture
 * rather than two.
 *
 * @param concerns - What is wrong, worst first.
 * @param onOpenPanel - Called with the panel a concern is dealt with in.
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
                  <Icon of={InformationCircleIcon} size={16} />
                ) : (
                  <Icon of={Alert02Icon} size={16} />
                )}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-text">{concern.title}</span>
                <span className="truncate text-xs text-text-muted">{concern.detail}</span>
              </span>

              <Icon of={ArrowRight01Icon} size={14} className="shrink-0 text-text-muted" />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
};

ConcernsBanner.displayName = 'ConcernsBanner';

export { ConcernsBanner };
