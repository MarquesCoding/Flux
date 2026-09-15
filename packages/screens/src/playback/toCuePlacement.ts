import type { CSSProperties } from 'react';
import type { SubtitleCue } from '@ValenceClient/playback/fetchSubtitleCues';

type CuePlacement = {
  box: CSSProperties;
  justify: 'flex-start' | 'center' | 'flex-end';
};

const COLUMN_OF = ['left', 'centre', 'right'] as const;

const ROW_OF = ['bottom', 'middle', 'top'] as const;

const ANCHOR_ACROSS = { left: '0', centre: '-50%', right: '-100%' } as const;

const ANCHOR_DOWN = { bottom: '-100%', middle: '-50%', top: '0' } as const;

const JUSTIFY_OF = {
  left: 'flex-start',
  centre: 'center',
  right: 'flex-end',
} as const;

/**
 * Reads a keypad alignment as the corner it anchors to.
 *
 * @param alignment - The keypad position, 1 to 9.
 * @returns Which third of the picture it sits in, across and down.
 */
const cornerOf = (
  alignment: number,
): { across: (typeof COLUMN_OF)[number]; down: (typeof ROW_OF)[number] } => {
  const index = Math.min(Math.max(Math.round(alignment), 1), 9) - 1;

  return {
    across: COLUMN_OF[index % 3] ?? 'centre',
    down: ROW_OF[Math.floor(index / 3)] ?? 'bottom',
  };
};

/**
 * Works out where on the picture a line goes.
 *
 * A line the script positioned is put at that point and hung from the corner its alignment names, so
 * that `\pos` with a bottom-right alignment puts the bottom right of the text on the point rather
 * than the top left of it. Everything is a fraction of the picture, so a script written for one
 * resolution lands in the same place shown at another.
 *
 * A line with no position of its own is pushed against the edge its alignment names, inside the
 * margins its style asked for.
 *
 * Dialogue is the exception, and is not placed from the file at all: it sits where the player puts
 * it, which moves when the controls come up. The file cannot know the controls are there and the
 * player does.
 *
 * @param cue - The line.
 * @param liftedBy - How far up from the bottom dialogue should sit, as a CSS length.
 * @returns Where to put the box, and how to line the text up inside it.
 */
const toCuePlacement = (cue: SubtitleCue, liftedBy: string): CuePlacement => {
  const { across, down } = cornerOf(cue.alignment);

  if (!cue.isSign) {
    return { box: { left: 0, right: 0, bottom: liftedBy }, justify: 'center' };
  }

  if (cue.position !== null) {
    return {
      box: {
        left: `${(cue.position.x * 100).toString()}%`,
        top: `${(cue.position.y * 100).toString()}%`,
        transform: `translate(${ANCHOR_ACROSS[across]}, ${ANCHOR_DOWN[down]})`,
      },
      justify: JUSTIFY_OF[across],
    };
  }

  const vertical = `${(cue.margins.vertical * 100).toString()}%`;

  return {
    box: {
      left: `${(cue.margins.left * 100).toString()}%`,
      right: `${(cue.margins.right * 100).toString()}%`,
      ...(down === 'top' ? { top: vertical } : {}),
      ...(down === 'bottom' ? { bottom: vertical } : {}),
      ...(down === 'middle' ? { top: '50%', transform: 'translateY(-50%)' } : {}),
    },
    justify: JUSTIFY_OF[across],
  };
};

export type { CuePlacement };

export { toCuePlacement };
