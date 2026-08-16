import { Menu } from '@base-ui/react/menu';
import { cn } from '@FluxUI/cn';
import { POPUP_MOTION } from '@FluxUI/animations/popup';
import { HoverHighlight } from '@FluxUI/HoverHighlight';
import { useSlidingHighlight } from '@FluxUI/useSlidingHighlight';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { ActionMenuProps } from './ActionMenu.types';

/**
 * A menu of things to do — rename, rescan, delete — rather than a value to pick, which is what an
 * option menu is for. Items can be grouped, marked destructive so they read as dangerous before
 * they are pressed, and disabled with the reason still visible.
 *
 * @param label - What the menu is, read out to anybody who cannot see it.
 * @param trigger - The control that opens it.
 * @param groups - The items, in groups separated by a rule.
 * @param align - Which edge of the trigger the menu lines up with.
 * @param className - Extra classes for the caller's own layout.
 */
const ActionMenu = ({
  label,
  trigger,
  groups,
  align = 'end',
  isDisabled = false,
  className,
}: ActionMenuProps) => {
  const portalContainer = usePortalContainer();

  const { containerRef, rect, follow, clear } = useSlidingHighlight();

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        disabled={isDisabled}
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-full',
          'text-current transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
          'hover:bg-[var(--surface-hover)] data-[popup-open]:bg-[var(--surface-hover)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        {trigger}
      </Menu.Trigger>

      <Menu.Portal container={portalContainer}>
        <Menu.Positioner sideOffset={8} align={align} className="z-50">
          <Menu.Popup
            aria-label={label}
            className={cn(
              'flux-glass min-w-56 overflow-hidden rounded-xl p-1.5 text-sm text-text',
              POPUP_MOTION,
            )}
          >
            <div
              ref={containerRef}
              className="relative flex flex-col"
              onPointerMove={follow}
              onPointerLeave={clear}
              onFocusCapture={follow}
              onBlurCapture={clear}
            >
              <HoverHighlight rect={rect} radius="nested" className="bg-[var(--surface-hover)]" />

              {groups.map((group, index) => (
                <Menu.Group
                  key={group.name ?? `group-${index.toString()}`}
                  className={cn(
                    'relative z-10 flex flex-col',
                    index === 0 ? '' : 'mt-1.5 border-t border-[var(--surface-line)] pt-1.5',
                  )}
                >
                  {group.name === undefined ? null : (
                    <Menu.GroupLabel className="px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-text-muted">
                      {group.name}
                    </Menu.GroupLabel>
                  )}

                  {group.items.map((item) => (
                    <Menu.Item
                      key={item.id}
                      data-highlight={item.id}
                      disabled={item.isDisabled ?? false}
                      onClick={item.onChoose}
                      className={cn(
                        'flex cursor-default items-center gap-3 rounded-[1.375rem] px-3 py-2.5 outline-none',
                        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
                        item.isDestructive === true ? 'text-danger' : 'text-text',
                      )}
                    >
                      {item.icon === undefined ? null : (
                        <span className="flex size-4 shrink-0 items-center justify-center">
                          {item.icon}
                        </span>
                      )}

                      <span className="flex-1 truncate text-left">{item.label}</span>

                      {item.detail === undefined ? null : (
                        <span className="shrink-0 text-xs text-text-muted">{item.detail}</span>
                      )}
                    </Menu.Item>
                  ))}
                </Menu.Group>
              ))}
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
};

ActionMenu.displayName = 'ActionMenu';

export { ActionMenu };
