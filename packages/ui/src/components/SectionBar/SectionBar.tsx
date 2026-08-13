import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Menu } from '@base-ui/react/menu';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { cn } from '@FluxUI/cn';
import type { SectionBarProps } from './SectionBar.types';

/**
 * How a popup arrives and leaves.
 *
 * Quicker than a dialog and travelling a shorter distance, because this one is
 * opened by arriving rather than by deciding: a pointer moving along the bar
 * is asking what is in each family, and an answer that takes a fifth of a
 * second to resolve is an answer that arrives after the question has moved on.
 */
const POPUP_MOTION = [
  'origin-[var(--transform-origin)] transition-[transform,opacity]',
  'duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
  'data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0',
  'motion-reduce:transition-opacity',
  'motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100',
].join(' ');

/**
 * What a pill looks like, whether it opens or goes straight somewhere.
 */
const PILL = [
  'relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
].join(' ');

/**
 * How the mark travels between families.
 *
 * The dock's spring, because it is the dock's gesture: something following a
 * pointer, which does not move on a curve chosen in advance.
 */
const MARK_MOTION = { type: 'spring', stiffness: 480, damping: 38 } as const;

/**
 * How long a pointer rests on a family before it opens.
 *
 * Not nought. A pointer crossing the bar on its way somewhere else passes over
 * every family in it, and opening on contact would flash four menus at
 * somebody who was only travelling. Short enough that aiming at one and
 * waiting does not feel like waiting.
 */
const OPEN_DELAY_MILLISECONDS = 70;

/**
 * How long an opened family waits before closing again.
 *
 * The popup hangs below the pill with a gap between them, and reaching into it
 * means crossing that gap. Closing the moment the pointer leaves the pill
 * would shut the menu on its way to being used.
 */
const CLOSE_DELAY_MILLISECONDS = 180;

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
 * rather than finding room on a line.
 *
 * A family keeps its own name whichever of its sections is showing, and says
 * it holds you by being lit rather than by renaming itself. A pill that
 * renamed itself would make the bar's labels move as somebody used it — the
 * word under the pointer would not be the word that was aimed at — and it
 * would leave nothing on screen saying what else is in there. Which one it is
 * is a question the open menu answers, with a tick.
 *
 * One mark, as on the dock. It rests on the family being stood in, follows the
 * pointer to whatever it passes over, and returns the moment the pointer
 * leaves. The same gesture answering the same question in both bars, which is
 * "what would happen if I pressed now" — two ways of saying that is one too
 * many, and this is the platform's other navigation.
 *
 * A family opens on hover as well as on press, the way a menu bar does: this
 * is somebody looking for where to go, and making them press to find out what
 * is behind a word turns looking into a decision.
 *
 * The sections inside a family are a radio group rather than commands, because
 * that is what they are: one of them is where you are, and choosing another is
 * moving rather than doing.
 */
const SectionBar = ({ label, groups, value, onValueChange, className }: SectionBarProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [pointedAt, setPointedAt] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  /**
   * What each pill is called for the purposes of the mark.
   *
   * A family answers by its name and a lone section by its own, because those
   * are the things the mark travels between: what the bar shows is families,
   * however many sections are folded into them.
   */
  const nameOf = (groupIndex: number, itemId: string): string =>
    groups[groupIndex]?.label ?? itemId;

  const here = groups.reduce<string | null>(
    (found, group, at) =>
      found ?? (group.items.some((item) => item.id === value) ? nameOf(at, value) : null),
    null,
  );

  /**
   * Which pill the mark is resting on.
   *
   * Whatever is being pointed at, or failing that whatever is standing open,
   * or failing that where you actually are. The middle one is what keeps the
   * mark on a family while the pointer is down inside its menu: leaving the
   * pill is not leaving the family when the family is what opened.
   */
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
                onOpenChange={(isOpen) => {
                  setOpened((was) => (isOpen ? named : was === named ? null : was));
                }}
              >
                <Menu.Trigger
                  openOnHover
                  delay={OPEN_DELAY_MILLISECONDS}
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
