import { useEffect, useRef, useState } from 'react';
import { cn } from '@ValenceUI/cn';
import { Button } from '@ValenceUI/Button';
import type { ReadMoreProps } from './ReadMore.types';

const CLAMP_CLASSES: Record<number, string> = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
};

/**
 * A passage of text cut to a few lines, with a way to see the rest.
 *
 * The control appears only where there is actually more to see, which is measured rather than
 * guessed at from the length of the string: a paragraph's height depends on the width it is given
 * and the size the reader has chosen, so counting characters offers to expand text that is already
 * whole. It is measured again when the width changes, since a passage that fitted in a wide dialog
 * may not fit in a narrow one.
 *
 * @param children - The text.
 * @param lines - How many lines to show before cutting.
 * @param moreLabel - What the control says when there is more to see.
 * @param lessLabel - What it says when everything is showing.
 * @param className - Extra classes for the caller's own layout.
 * @returns The passage, and the control where one is warranted.
 */
const ReadMore = ({
  children,
  lines = 6,
  moreLabel = 'Read more',
  lessLabel = 'Read less',
  className,
}: ReadMoreProps) => {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isWhole, setIsWhole] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const element = textRef.current;

    if (element === null) {
      return;
    }

    const measure = () => {
      setHasMore(element.scrollHeight - element.clientHeight > 1);
    };

    measure();

    const watcher = new ResizeObserver(measure);

    watcher.observe(element);

    return () => {
      watcher.disconnect();
    };
  }, [children, lines]);

  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <p
        ref={textRef}
        className={cn(
          'max-w-[70ch] text-[0.95rem] leading-relaxed text-text',
          isWhole ? '' : (CLAMP_CLASSES[lines] ?? 'line-clamp-6'),
        )}
      >
        {children}
      </p>

      {!hasMore && !isWhole ? null : (
        <Button
          variant="link"
          size="none"
          className="text-sm text-text-muted hover:text-text"
          onClick={() => {
            setIsWhole((was) => !was);
          }}
        >
          {isWhole ? lessLabel : moreLabel}
        </Button>
      )}
    </div>
  );
};

ReadMore.displayName = 'ReadMore';

export { ReadMore };
