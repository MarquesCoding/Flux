import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@ValenceUI/cn';
import { POPUP_MOTION } from '@ValenceUI/animations/motion';
import { HoverHighlight } from '@ValenceUI/HoverHighlight';
import { useSlidingHighlight } from '@ValenceUI/useSlidingHighlight';
import { usePortalContainer } from '@ValenceUI/usePortalContainer';
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
    <RadixMenu.Root>
      <RadixMenu.Trigger
        aria-label={label}
        disabled={isDisabled}
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-md outline-none',
          'text-current transition-colors duration-[var(--duration-instant)] ease-[var(--ease-out)]',
          'motion-reduce:transition-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
          'hover:bg-[var(--surface-hover)] data-[state=open]:bg-[var(--surface-hover)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        {trigger}
      </RadixMenu.Trigger>

      <RadixMenu.Portal {...(portalContainer === undefined ? {} : { container: portalContainer })}>
        <RadixMenu.Content
          aria-label={label}
          sideOffset={8}
          align={align}
          data-slot="menu-content"
          className={cn(
            'z-50 valence-glass min-w-56 overflow-hidden rounded-lg p-1.5 text-sm text-text outline-none',
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
              <RadixMenu.Group
                key={group.name ?? `group-${index.toString()}`}
                className={cn(
                  'relative z-10 flex flex-col',
                  index === 0 ? '' : 'mt-1.5 border-t border-[var(--surface-line)] pt-1.5',
                )}
              >
                {group.name === undefined ? null : (
                  <RadixMenu.Label className="px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-text-muted">
                    {group.name}
                  </RadixMenu.Label>
                )}

                {group.items.map((item) => (
                  <RadixMenu.Item
                    key={item.id}
                    data-highlight={item.id}
                    disabled={item.isDisabled ?? false}
                    onSelect={item.onChoose}
                    className={cn(
                      'flex cursor-default items-center gap-3 rounded-sm px-3 py-2.5 outline-none',
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
                  </RadixMenu.Item>
                ))}
              </RadixMenu.Group>
            ))}
          </div>
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
};

ActionMenu.displayName = 'ActionMenu';

export { ActionMenu };
