import { useEffect, useRef, useState } from 'react';

const OPEN = '[aria-expanded="true"]';

const MARKED = '[data-highlight]';

/**
 * Reads which action in the dock currently has a panel open, by watching for `aria-expanded` on the
 * trigger that opened it. Asked of the DOM rather than passed down as a prop because a dock action's
 * control is deliberately opaque — it is whatever the caller handed over, and the dock cannot know
 * which kinds of thing open a panel and which do not.
 *
 * Deliberately `aria-expanded` rather than the `data-popup-open` an open trigger is styled by: a
 * tooltip is a popup too, every control in the dock has one, and watching that attribute would have
 * stopped every gesture the moment a pointer arrived. Only something a viewer can expand says it is
 * expanded, which is exactly the distinction wanted here.
 *
 * @returns A ref for the element holding the actions, and which of them has a panel open.
 */
const useOpenAction = (): {
  actionsRef: React.RefObject<HTMLDivElement | null>;
  openAction: string | null;
} => {
  const actionsRef = useRef<HTMLDivElement>(null);
  const [openAction, setOpenAction] = useState<string | null>(null);

  useEffect(() => {
    const holder = actionsRef.current;

    if (holder === null) {
      return;
    }

    const read = () => {
      const opened = holder.querySelector(OPEN);

      setOpenAction(opened?.closest(MARKED)?.getAttribute('data-highlight') ?? null);
    };

    read();

    const watching = new MutationObserver(read);

    watching.observe(holder, {
      attributes: true,
      attributeFilter: ['aria-expanded'],
      subtree: true,
    });

    return () => {
      watching.disconnect();
    };
  }, []);

  return { actionsRef, openAction };
};

export { useOpenAction };
