import { useEffect, useRef } from 'react';

/**
 * Which way somebody moved through a row of tabs: forwards where the one they chose sits after the
 * one they were on, and backwards where it sits before it.
 *
 * So that what arrives can come in from the side it was reached from, the way a submenu does. A
 * panel that always slides in from the same side says nothing about where you went; one that comes
 * from the direction you travelled makes going back feel like going back.
 *
 * The previous tab is remembered after the render rather than during it, so the render itself stays
 * pure and the answer is the same however many times React draws it.
 *
 * @param order - The tabs, in the order they are offered.
 * @param value - The tab now showing.
 * @returns 1 where the move was forwards, -1 where it was backwards.
 */
const useTravelDirection = (order: readonly string[], value: string): 1 | -1 => {
  const previous = useRef(value);

  const from = order.indexOf(previous.current);
  const to = order.indexOf(value);

  useEffect(() => {
    previous.current = value;
  }, [value]);

  return to < from ? -1 : 1;
};

export { useTravelDirection };
