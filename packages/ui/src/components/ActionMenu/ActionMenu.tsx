import { Menu } from '@base-ui/react/menu';
import { cn } from '@FluxUI/cn';
import { HoverHighlight } from '@FluxUI/HoverHighlight';
import { useSlidingHighlight } from '@FluxUI/useSlidingHighlight';
import type { ActionMenuProps } from './ActionMenu.types';

const POPUP_MOTION = cn(
  'origin-[var(--transform-origin)] transition-[transform,opacity] duration-[var(--duration-base)] ease-[var(--ease-soft)]',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
);

/**
 * A menu of things to do, rather than a value to pick.
 *
 * The highlight is one rectangle that travels between the rows, not a
 * background each row paints for itself — moving between two actions should
 * feel like carrying the highlight with the pointer rather than watching one
 * fade out as another fades in.
 *
 * It answers to focus as well as to the pointer, so arrowing down a menu moves
 * the same rectangle a mouse would drag. Anything else leaves somebody on a
 * keyboard with no idea which row they are on.
 */
const ActionMenu = ({
  label,
  trigger,
  groups,
  align = 'end',
  isDisabled = false,
  className,
}: ActionMenuProps) => {
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

      <Menu.Portal>
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
