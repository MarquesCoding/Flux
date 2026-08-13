import type { ReactElement } from 'react';

/**
 * What a control is rendered with, once the tooltip has added its own.
 */
type ControlProperties = Record<string, string | number | boolean | object | null | undefined>;

type TooltipProps = {
  /**
   * What the control does, in words.
   *
   * The same words as its accessible name. A tooltip that says something
   * different from the label is a second name for the same thing, and the two
   * drift.
   */
  label: string;
  /**
   * The control itself.
   *
   * One element rather than anything renderable: the tooltip hands its
   * handlers to what it is given and hangs its panel off that element's
   * position, and a fragment has no position to hang anything off.
   *
   * Typed as a bag of properties because that is what it is handed — the
   * element is rendered with whatever the tooltip needs to add to it.
   */
  children: ReactElement<ControlProperties>;
  /**
   * Which way it hangs. Above by default, since most controls carrying one sit
   * in a bar along the bottom of something.
   */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Whether to say anything at all.
   *
   * For the caller that shows a name beside the icon already, where a tooltip
   * would repeat a word the viewer is looking at.
   */
  isDisabled?: boolean;
  /**
   * How long a pointer must rest before the name appears.
   *
   * Left alone almost everywhere: a tooltip that arrives the instant a pointer
   * crosses a control turns a bar of them into a flicker of boxes. Set to
   * nought only where the name is the whole affordance — a row of icons with
   * no words at all, where waiting is the interface withholding the one thing
   * being asked for.
   */
  delayMilliseconds?: number;
};

export type { ControlProperties, TooltipProps };
