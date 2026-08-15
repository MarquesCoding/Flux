import { Menu } from '@base-ui/react/menu';
import { RiCheckLine } from '@remixicon/react';
import { cn } from '@FluxUI/cn';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { OptionMenuProps } from './OptionMenu.types';

const POPUP_MOTION = [
  'origin-[var(--transform-origin)] transition-[transform,opacity]',
  'duration-[var(--duration-base)] ease-[var(--ease-soft)]',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
  'motion-reduce:transition-opacity',
  'motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100',
].join(' ');

/**
 * A menu of mutually exclusive choices, in one or more columns.
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
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        title={label}
        disabled={isDisabled}
        className={cn(
          'inline-flex shrink-0 items-center text-current',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          triggerShape === 'field'
            ? cn(
                'h-9 w-full justify-between gap-2 rounded-md px-3.5 text-sm',
                'border border-[var(--surface-line)] bg-[var(--surface-hover)]',
                'hover:border-[var(--surface-divider)]',
              )
            : cn(
                'size-9 justify-center rounded-full',
                'hover:bg-[var(--surface-hover)] data-[popup-open]:bg-[var(--surface-active)]',
              ),
          className,
        )}
      >
        {trigger}
      </Menu.Trigger>

      <Menu.Portal container={portalContainer}>
        <Menu.Positioner sideOffset={8} align={align} className="z-50">
          <Menu.Popup
            aria-label={label}
            {...(matchTriggerWidth ? { style: { minWidth: 'var(--anchor-width)' } } : {})}
            className={cn(
              'flux-glass flex max-h-80 flex-col overflow-hidden rounded-xl p-1.5 text-sm text-text',
              POPUP_MOTION,
            )}
          >
            <div className="flex overflow-hidden">
              {groups.map((group) => (
                <Menu.Group
                  key={group.name}
                  className="flex min-w-44 flex-1 flex-col overflow-y-auto border-l border-[var(--surface-line)] pl-1.5 first:border-l-0 first:pl-0"
                >
                  <Menu.GroupLabel className="px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-text-muted">
                    {group.name}
                  </Menu.GroupLabel>

                  <Menu.RadioGroup
                    value={group.selectedId}
                    onValueChange={(next) => {
                      group.onSelect(String(next));
                    }}
                    className="flex flex-col"
                  >
                    {group.options.map((option) => (
                      <Menu.RadioItem
                        key={option.id}
                        value={option.id}
                        closeOnClick
                        className={cn(
                          'flex cursor-default items-center justify-between gap-4 rounded-[1.375rem] px-3 py-2.5',
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

                        <Menu.RadioItemIndicator className="flex size-4 shrink-0 items-center justify-center text-accent">
                          <RiCheckLine size={15} aria-hidden />
                        </Menu.RadioItemIndicator>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Group>
              ))}
            </div>

            {footer === undefined ? null : (
              <div className="border-t border-[var(--surface-line)] px-3 py-2.5">{footer}</div>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
};

OptionMenu.displayName = 'OptionMenu';

export { OptionMenu };
