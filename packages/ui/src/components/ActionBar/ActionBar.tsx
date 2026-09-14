import { MoreHorizontalIcon } from '@hugeicons/core-free-icons';
import { ActionMenu } from '@ValenceUI/ActionMenu';
import { Button } from '@ValenceUI/Button';
import { Icon } from '@ValenceUI/Icon';
import { cn } from '@ValenceUI/cn';
import type { ActionBarProps } from './ActionBar.types';

/**
 * The things a dialog is for: the one worth pressing, and the rest beside it.
 *
 * On anything wide they are laid out as equal columns, which is what a row of actions should look
 * like when there is room for it. On a phone there is not: three of them either run off the side or
 * wrap into a grid with a hole in it, and a fourth makes every label unreadable. So the main action
 * keeps the bar and the rest fold into a menu — the same actions, in the same order, reached by one
 * more press.
 *
 * The two arrangements are both drawn and one is hidden, rather than measured and chosen. What to
 * show is a question about width, which CSS already knows the answer to; asking JavaScript means
 * asking again on every resize and being wrong until the first one.
 *
 * @param label - What the folded menu is, read out to anybody who cannot see it.
 * @param primary - The action worth pressing, which keeps the bar at every width.
 * @param actions - Everything else, shown beside it or folded into the menu.
 * @param className - Extra classes for the caller's own layout.
 */
const ActionBar = ({ label, primary, actions, className }: ActionBarProps) => (
  <div
    className={cn(
      'grid w-full gap-3',
      actions.length === 0 ? 'grid-cols-1' : 'grid-cols-[1fr_auto]',
      'sm:grid-flow-col sm:grid-cols-none sm:[grid-auto-columns:1fr]',
      className,
    )}
  >
    {primary}

    {actions.length === 0 ? null : (
      <>
        <span className="hidden sm:contents">
          {actions.map((action) => (
            <Button key={action.id} variant="secondary" size="lg" onClick={action.onChoose}>
              {action.icon}
              {action.label}
            </Button>
          ))}
        </span>

        <ActionMenu
          label={label}
          align="end"
          className="size-12 rounded-full border border-[var(--surface-line)] bg-secondary sm:hidden"
          trigger={<Icon of={MoreHorizontalIcon} size={22} />}
          groups={[
            {
              items: actions.map((action) => ({
                id: action.id,
                label: action.label,
                ...(action.icon === undefined ? {} : { icon: action.icon }),
                onChoose: action.onChoose,
              })),
            },
          ]}
        />
      </>
    )}
  </div>
);

ActionBar.displayName = 'ActionBar';

export { ActionBar };
