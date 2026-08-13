import { Menu } from '@base-ui/react/menu';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { cn } from '@FluxUI/cn';
import type { SectionBarProps } from './SectionBar.types';

/**
 * How a popup arrives and leaves.
 *
 * The same fade-and-settle every other menu on the platform uses.
 */
const POPUP_MOTION = [
  'origin-[var(--transform-origin)] transition-[transform,opacity]',
  'duration-[var(--duration-base)] ease-[var(--ease-soft)]',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
  'motion-reduce:transition-opacity',
  'motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100',
].join(' ');

/**
 * What a pill looks like, whether it opens or goes straight somewhere.
 */
const PILL = [
  'relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
  'text-text-muted hover:text-text focus-visible:text-text',
].join(' ');

/**
 * What the pill of whichever section is showing wears.
 */
const HERE = 'bg-[var(--surface-active)] font-medium text-text';

/**
 * The bar of sections at the top of an area, where a family opens as one.
 *
 * A row of every section was fine at eight and stops being fine at fourteen:
 * an admin area grows a page each time the platform grows a feature, and a bar
 * that lengthens by one every time eventually wraps, scrolls, or runs off the
 * end of a laptop.
 *
 * Families open instead. The bar stays as wide as it has families however many
 * sections are inside them, and adding a page means adding it to a family
 * rather than finding room on a line. A family whose section is showing wears
 * that section's name rather than its own, so the bar still answers "where am
 * I" with nothing opened.
 *
 * A family of one does not open, because a menu holding a single choice is a
 * button asking to be pressed twice. That is what keeps the section everybody
 * arrives at a single press.
 *
 * The sections inside a family are a radio group rather than commands, because
 * that is what they are: one of them is where you are, and choosing another is
 * moving rather than doing.
 */
const SectionBar = ({ label, groups, value, onValueChange, className }: SectionBarProps) => (
  <nav
    aria-label={label}
    className={cn(
      'flux-rail flux-glass flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full p-1.5',
      className,
    )}
  >
    {groups.map((group, index) => {
      const showing = group.items.find((item) => item.id === value);
      const opens = group.label !== undefined && group.items.length > 1;

      return (
        <div key={group.label ?? `group-${index.toString()}`} className="flex items-center gap-1">
          {index === 0 ? null : (
            <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--surface-divider)]" />
          )}

          {group.label === undefined || !opens ? (
            group.items.map((item) => (
              <Button
                key={item.id}
                variant="bare"
                size="none"
                isActive={item.id === value}
                onClick={() => {
                  onValueChange(item.id);
                }}
                className={cn(PILL, item.id === value && HERE)}
              >
                {item.label}
              </Button>
            ))
          ) : (
            <Menu.Root>
              <Menu.Trigger
                aria-label={
                  showing === undefined ? group.label : `${group.label}: ${showing.label}`
                }
                className={cn(PILL, 'data-[popup-open]:text-text', showing !== undefined && HERE)}
              >
                {showing?.label ?? group.label}
                <IconChevronDown size={14} aria-hidden />
              </Menu.Trigger>

              <Menu.Portal>
                <Menu.Positioner sideOffset={8} align="start" className="z-50">
                  <Menu.Popup
                    aria-label={group.label}
                    className={cn(
                      'flux-glass flex min-w-44 flex-col rounded-xl p-1.5 text-sm text-text',
                      POPUP_MOTION,
                    )}
                  >
                    <Menu.Group className="flex flex-col">
                      <Menu.GroupLabel className="px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-text-muted">
                        {group.label}
                      </Menu.GroupLabel>

                      <Menu.RadioGroup
                        value={value}
                        onValueChange={(next) => {
                          onValueChange(String(next));
                        }}
                        className="flex flex-col"
                      >
                        {group.items.map((item) => (
                          <Menu.RadioItem
                            key={item.id}
                            value={item.id}
                            closeOnClick
                            className={cn(
                              'flex cursor-default items-center justify-between gap-4 rounded-[1.375rem] px-3 py-2.5',
                              'outline-none transition-colors duration-[var(--duration-fast)]',
                              'data-[highlighted]:bg-[var(--surface-hover)]',
                            )}
                          >
                            {item.label}

                            <Menu.RadioItemIndicator className="flex size-4 shrink-0 items-center justify-center text-accent">
                              <IconCheck size={15} stroke={3} aria-hidden />
                            </Menu.RadioItemIndicator>
                          </Menu.RadioItem>
                        ))}
                      </Menu.RadioGroup>
                    </Menu.Group>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          )}
        </div>
      );
    })}
  </nav>
);

SectionBar.displayName = 'SectionBar';

export { SectionBar };
