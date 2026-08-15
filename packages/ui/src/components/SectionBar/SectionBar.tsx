import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Menu } from '@base-ui/react/menu';
import { RiArrowDownSLine, RiCheckLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { cn } from '@FluxUI/cn';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { SectionBarProps } from './SectionBar.types';

const POPUP_MOTION = [
  'origin-[var(--transform-origin)] transition-[transform,opacity]',
  'duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
  'data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0',
  'motion-reduce:transition-opacity',
  'motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100',
].join(' ');

const PILL = [
  'relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
].join(' ');

const MARK_MOTION = { type: 'spring', stiffness: 480, damping: 38 } as const;

const OPEN_DELAY_MILLISECONDS = 70;

const CLOSE_DELAY_MILLISECONDS = 180;

/**
 * The bar of sections at the top of an area, where a family opens as one.
 */
const SectionBar = ({ label, groups, value, onValueChange, className }: SectionBarProps) => {
  const portalContainer = usePortalContainer();

  const prefersReducedMotion = useReducedMotion();
  const [pointedAt, setPointedAt] = useState<string | null>(null);

  const [opened, setOpened] = useState<string | null>(null);

  /**
   * What each pill is called for the purposes of the mark.
   */
  const nameOf = (groupIndex: number, itemId: string): string =>
    groups[groupIndex]?.label ?? itemId;

  const here = groups.reduce<string | null>(
    (found, group, at) =>
      found ?? (group.items.some((item) => item.id === value) ? nameOf(at, value) : null),
    null,
  );

  const lit = pointedAt ?? opened ?? here;

  const mark = (
    <motion.span
      layoutId="section-bar-mark"
      transition={prefersReducedMotion === true ? { duration: 0 } : MARK_MOTION}
      className="absolute inset-0 -z-10 rounded-full bg-[var(--surface-active)]"
    />
  );

  return (
    <nav
      aria-label={label}
      onPointerLeave={() => {
        setPointedAt(null);
      }}
      onBlur={() => {
        setPointedAt(null);
      }}
      className={cn(
        'flux-rail flux-glass relative flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full p-1.5',
        className,
      )}
    >
      {groups.map((group, index) => {
        const holds = group.items.some((item) => item.id === value);
        const opens = group.label !== undefined && group.items.length > 1;
        const named = group.label ?? '';

        return (
          <div
            key={group.label ?? `group-${index.toString()}`}
            className="relative z-10 flex items-center gap-1"
          >
            {index === 0 ? null : (
              <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--surface-divider)]" />
            )}

            {opens && group.label !== undefined ? (
              <Menu.Root
                open={opened === named}
                onOpenChange={(isOpen) => {
                  setOpened((was) => (isOpen ? named : was === named ? null : was));
                }}
              >
                <Menu.Trigger
                  openOnHover
                  delay={opened === null ? OPEN_DELAY_MILLISECONDS : 0}
                  closeDelay={CLOSE_DELAY_MILLISECONDS}
                  onPointerEnter={() => {
                    setPointedAt(named);
                  }}
                  onFocus={() => {
                    setPointedAt(named);
                  }}
                  className={cn(
                    PILL,
                    lit === named || holds
                      ? 'font-medium text-text'
                      : 'text-text-muted hover:text-text focus-visible:text-text',
                  )}
                >
                  {lit === named ? mark : null}

                  {group.label}

                  <RiArrowDownSLine size={14} aria-hidden />
                </Menu.Trigger>

                <Menu.Portal container={portalContainer}>
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
                                <RiCheckLine size={15} aria-hidden />
                              </Menu.RadioItemIndicator>
                            </Menu.RadioItem>
                          ))}
                        </Menu.RadioGroup>
                      </Menu.Group>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            ) : (
              group.items.map((item) => (
                <Button
                  key={item.id}
                  variant="bare"
                  size="none"
                  isActive={item.id === value}
                  aria-current={item.id === value ? 'page' : undefined}
                  onPointerEnter={() => {
                    setPointedAt(nameOf(index, item.id));
                  }}
                  onFocus={() => {
                    setPointedAt(nameOf(index, item.id));
                  }}
                  onClick={() => {
                    onValueChange(item.id);
                  }}
                  className={cn(
                    PILL,
                    lit === nameOf(index, item.id) || item.id === value
                      ? 'font-medium text-text'
                      : 'text-text-muted hover:text-text focus-visible:text-text',
                  )}
                >
                  {lit === nameOf(index, item.id) ? mark : null}

                  {item.label}
                </Button>
              ))
            )}
          </div>
        );
      })}
    </nav>
  );
};

SectionBar.displayName = 'SectionBar';

export { SectionBar };
