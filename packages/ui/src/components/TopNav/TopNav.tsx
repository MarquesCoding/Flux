import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { IconMenu2 } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { cn } from '@FluxUI/cn';
import { Tooltip } from '@FluxUI/Tooltip';
import { PopoverPanel } from '@FluxUI/PopoverPanel';
import type { TopNavProps } from './TopNav.types';

/**
 * The bar across the top, as two things rather than one.
 *
 * Places in one capsule and tools in another, floating over the page with a
 * gap between them. A single strip across the top makes every item look like
 * the same kind of item; two shapes say plainly that one group takes you
 * somewhere and the other does something where you are.
 *
 * Glass rather than a solid bar, so artwork carries on underneath: the page
 * belongs to what is being shown, and the navigation is something resting on
 * top of it.
 *
 * The places are named rather than drawn, and only the one being stood on
 * carries its icon — which arrives beside the word rather than replacing it,
 * so nothing shifts about except the badge itself.
 */
const TopNav = ({ brand, items, selectedId, onSelect, actions = [], className }: TopNavProps) => {
  const prefersReducedMotion = useReducedMotion();
  // Closed when a place is chosen: a menu still sitting over the page it
  // navigated to is a menu somebody has to dismiss to see what they asked for.
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header
      className={cn('pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-6', className)}
    >
      <nav
        aria-label="Sections"
        // Three columns where there is room for three: the places belong in
        // the middle of the screen, not in the middle of whatever is left over
        // once the tools have taken their width. On a phone there is no such
        // room — three columns there means a middle one too wide to fit,
        // pushed off both edges — so it is a row, and the places take what is
        // left and scroll within it.
        className="mx-auto flex max-w-[1800px] items-center justify-between gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-3"
      >
        <div className="pointer-events-auto hidden min-w-0 items-center sm:flex">{brand}</div>

        {/* On a phone the places fold into one control. Two capsules and eight
            icons do not fit across a phone, and the honest answer to not
            fitting is to put the less urgent group away rather than to let it
            run off both edges. */}
        <div className="flux-glass pointer-events-auto flex shrink-0 items-center rounded-full p-1 sm:hidden">
          <PopoverPanel
            label="Where to go"
            side="bottom"
            trigger={<IconMenu2 size={20} aria-hidden />}
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          >
            <ul className="flex w-52 flex-col gap-0.5 py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Button
                    variant="bare"
                    size="none"
                    aria-current={item.id === selectedId ? 'page' : undefined}
                    onClick={() => {
                      setIsMenuOpen(false);
                      onSelect(item.id);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                      item.id === selectedId
                        ? 'bg-white/15 font-medium text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {item.icon === undefined ? null : (
                      <span className="flex shrink-0 items-center">{item.icon}</span>
                    )}
                    {item.label}
                  </Button>
                </li>
              ))}
            </ul>
          </PopoverPanel>
        </div>

        <ul className="flux-glass pointer-events-auto hidden min-w-0 items-center gap-0.5 overflow-x-auto rounded-full p-1 sm:flex sm:justify-self-center [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const isCurrent = item.id === selectedId;

            return (
              <li key={item.id} className="shrink-0">
                {/* Named on hover only while the name is not already
                    there. The place being stood on writes itself out beside
                    its icon, and a tooltip repeating it is the same word
                    twice. */}
                <Tooltip label={item.label} side="bottom" isDisabled={isCurrent}>
                  <Button
                    variant="bare"
                    size="none"
                    aria-label={item.label}
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={() => {
                      onSelect(item.id);
                    }}
                    className={cn(
                      // The same height as a tool, so the two capsules are the
                      // same capsule at different lengths rather than two
                      // near-misses sitting beside each other.
                      'relative flex h-10 items-center gap-1.5 rounded-full px-3 text-sm transition-colors duration-200',
                      isCurrent
                        ? 'font-medium text-text'
                        : 'text-text-muted hover:text-text focus-visible:text-text',
                    )}
                  >
                    {/* Under the word rather than around it, so the capsule
                      holds one moving highlight instead of five taking
                      turns. */}
                    {!isCurrent ? null : (
                      <motion.span
                        layoutId="top-nav-current"
                        transition={
                          prefersReducedMotion === true
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 420, damping: 34 }
                        }
                        className="absolute inset-0 -z-10 rounded-full bg-white/15"
                      />
                    )}

                    {item.icon === undefined ? null : (
                      <span className="flex shrink-0 items-center">{item.icon}</span>
                    )}

                    {/* The name only where it is being stood on. An icon is
                      enough to point at a place; a word is what tells you
                      where you are, and five words all the time is a strip of
                      words. */}
                    <AnimatePresence initial={false}>
                      {!isCurrent ? null : (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: prefersReducedMotion === true ? 0 : 0.24 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </Tooltip>
              </li>
            );
          })}
        </ul>

        <div className="flux-glass pointer-events-auto flex shrink-0 items-center gap-0.5 justify-self-end rounded-full p-1">
          {actions.map((action) =>
            action.control === undefined ? (
              <Tooltip key={action.id} label={action.label} side="bottom">
                <Button
                  variant="bare"
                  size="none"
                  aria-label={action.label}
                  aria-current={action.isCurrent === true ? 'page' : undefined}
                  onClick={action.onSelect}
                  className={cn(
                    'relative flex size-10 items-center justify-center rounded-full transition-colors duration-200',
                    action.isCurrent === true
                      ? 'bg-white/15 text-text'
                      : 'text-text-muted hover:bg-white/10 hover:text-text',
                  )}
                >
                  {action.icon}

                  {action.badge === undefined ? null : (
                    <span className="absolute -right-0.5 -top-0.5">{action.badge}</span>
                  )}
                </Button>
              </Tooltip>
            ) : (
              <div key={action.id} className="flex items-center">
                {action.control}
              </div>
            ),
          )}
        </div>
      </nav>
    </header>
  );
};

TopNav.displayName = 'TopNav';

export { TopNav };
