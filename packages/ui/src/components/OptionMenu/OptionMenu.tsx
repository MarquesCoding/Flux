import { Icon } from '@ValenceUI/Icon';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@ValenceUI/cn';
import { POPUP_MOTION } from '@ValenceUI/animations/motion';
import { usePortalContainer } from '@ValenceUI/usePortalContainer';
import type { OptionMenuProps } from './OptionMenu.types';

/**
 * A menu of choices where exactly one is in force — an audio track, a quality, a sort order. Shows
 * which is chosen rather than only changing what is beneath it, and lays out in columns where there
 * are more options than a single list would read well.
 *
 * @param label - What is being chosen, read out to anybody who cannot see the menu.
 * @param trigger - The control that opens it.
 * @param columns - The choices, in one or more named columns.
 * @param className - Extra classes for the caller's own layout.
 */
const OptionMenu = ({
  label,
  trigger,
  groups,
  footer,
  isDisabled = false,
  className,
  align = 'end',
  matchTriggerWidth = false,
  triggerShape = 'icon',
}: OptionMenuProps) => {
  const portalContainer = usePortalContainer();

  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger
        aria-label={label}
        title={label}
        disabled={isDisabled}
        className={cn(
          'inline-flex shrink-0 items-center text-current',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          triggerShape === 'field'
            ? cn(
                'h-8 w-full justify-between gap-2 rounded-pill px-3.5 text-[0.8125rem] font-medium',
                'border border-accent/30 bg-accent/15 text-accent',
                'hover:bg-accent/25',
              )
            : cn(
                'size-8 justify-center rounded-pill',
                'hover:bg-[var(--surface-hover)] data-[state=open]:bg-[var(--surface-active)]',
              ),
          className,
        )}
      >
        {trigger}
      </RadixMenu.Trigger>

      <RadixMenu.Portal {...(portalContainer === undefined ? {} : { container: portalContainer })}>
        <RadixMenu.Content
          sideOffset={8}
          align={align}
          aria-label={label}
          {...(matchTriggerWidth ? { style: { minWidth: 'var(--anchor-width)' } } : {})}
          className={cn(
            'valence-float z-50 flex max-h-80 flex-col overflow-hidden rounded-lg p-1.5 text-sm text-text',
            POPUP_MOTION,
          )}
        >
          <div className="flex overflow-hidden">
            {groups.map((group) => (
              <RadixMenu.Group
                key={group.name}
                className="flex min-w-44 flex-1 flex-col overflow-y-auto border-l border-[var(--surface-line)] pl-1.5 first:border-l-0 first:pl-0"
              >
                <RadixMenu.Label className="px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-text-muted">
                  {group.name}
                </RadixMenu.Label>

                <RadixMenu.RadioGroup
                  value={group.selectedId}
                  onValueChange={(next) => {
                    group.onSelect(String(next));
                  }}
                  className="flex flex-col"
                >
                  {group.options.map((option) => (
                    <RadixMenu.RadioItem
                      key={option.id}
                      value={option.id}
                      className={cn(
                        'flex cursor-default items-center justify-between gap-4 rounded-sm px-3 py-2.5',
                        'outline-none transition-colors duration-[var(--duration-fast)]',
                        'data-[highlighted]:bg-[var(--surface-hover)]',
                        'data-[checked]:text-text',
                      )}
                    >
                      <span className="flex flex-col">
                        {option.label}
                        {option.detail === undefined ? null : (
                          <span className="text-xs text-text-muted">{option.detail}</span>
                        )}
                      </span>

                      <RadixMenu.ItemIndicator className="flex size-4 shrink-0 items-center justify-center text-accent">
                        <Icon of={Tick02Icon} size={15} />
                      </RadixMenu.ItemIndicator>
                    </RadixMenu.RadioItem>
                  ))}
                </RadixMenu.RadioGroup>
              </RadixMenu.Group>
            ))}
          </div>

          {footer === undefined ? null : (
            <div className="border-t border-[var(--surface-line)] px-3 py-2.5">{footer}</div>
          )}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
};

OptionMenu.displayName = 'OptionMenu';

export { OptionMenu };
