import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { DotField } from '@FluxUI/DotField';
import { blendLights } from '@FluxUI/blendLights';
import type { MoodBackgroundProps, MoodLight } from './MoodBackground.types';

const BLOOMS = [
  { at: '14% 8%', size: '70vw 60vh', strength: 40 },
  { at: '86% 12%', size: '65vw 55vh', strength: 36 },
  { at: '10% 84%', size: '70vw 55vh', strength: 30 },
  { at: '90% 86%', size: '65vw 55vh', strength: 28 },
  { at: '50% 45%', size: '80vw 60vh', strength: 24 },
] as const;

const DRIFTS = ['34s', '46s', '58s', '41s', '52s'] as const;

const HOUSE = [
  'rgb(56 68 150)',
  'rgb(48 60 138)',
  'rgb(44 54 124)',
  'rgb(50 62 142)',
  'rgb(40 50 118)',
] as const;

const DEFAULT_LIGHTS: MoodLight[] = HOUSE.map((color) => ({ color }));

const EASE = 0.03;

const PARALLAX = 0.34;

/**
 * Writes one light as the CSS gradient that paints it, at the position and colour it was given.
 *
 * @param light - The colour and where it sits.
 * @param at - Which of the lights this is, which decides how large and strong its bloom is.
 * @returns The gradient, as CSS.
 */
const paint = (light: MoodLight, at: number): string => {
  const bloom = BLOOMS[at] ?? BLOOMS[0];

  return `radial-gradient(${bloom.size} at ${light.at ?? bloom.at}, color-mix(in oklab, ${light.color} ${bloom.strength.toString()}%, transparent), transparent 70%)`;
};

/**
 * Lights the page from behind with colours taken from whatever is on screen, so a library of a film
 * is lit by that film. The lights drift slowly rather than holding still, and can carry a grid over
 * them for the pages that want structure behind the artwork.
 *
 * @param lights - The colours and where they sit.
 * @param hasGrid - Whether to lay a grid over them.
 * @param isDrifting - Whether the lights move, or hold where they are.
 */
const MoodBackground = ({
  lights = [],
  hasGrid = false,
  isDrifting = false,
}: MoodBackgroundProps) => {
  const prefersReducedMotion = useReducedMotion();
  const given = lights.filter((light) => light.color !== '');
  const lit = given.length === 0 ? DEFAULT_LIGHTS : given;
  const bloomsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const heldRef = useRef<MoodLight[]>([]);
  const wantedRef = useRef<MoodLight[]>(lit);
  const paintedRef = useRef<string[]>([]);
  const driftingRef = useRef<HTMLDivElement | null>(null);
  const shiftedRef = useRef(-1);

  wantedRef.current = lit;

  useEffect(() => {
    if (heldRef.current.length === 0) {
      heldRef.current = wantedRef.current;
    }

    let frame = 0;

    const carry = () => {
      const wanted = wantedRef.current;

      heldRef.current =
        prefersReducedMotion === true || heldRef.current.length !== wanted.length
          ? wanted
          : blendLights(heldRef.current, wanted, EASE);

      const shift = Math.round(window.scrollY * PARALLAX);
      const drifting = driftingRef.current;

      if (drifting !== null && shiftedRef.current !== shift) {
        shiftedRef.current = shift;
        drifting.style.transform = `translate3d(0, ${shift.toString()}px, 0)`;
      }

      heldRef.current.forEach((light, at) => {
        const element = bloomsRef.current[at];
        const painted = paint(light, at);

        if (element !== null && element !== undefined && paintedRef.current[at] !== painted) {
          paintedRef.current[at] = painted;
          element.style.background = painted;
        }
      });

      frame = requestAnimationFrame(carry);
    };

    frame = requestAnimationFrame(carry);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [prefersReducedMotion]);

  return (
    <div
      role="presentation"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[140svh] overflow-hidden"
    >
      <div ref={driftingRef} className="absolute inset-0 will-change-transform">
        {lit.slice(0, BLOOMS.length).map((light, at) => (
          <span
            key={`bloom-${at.toString()}`}
            ref={(element) => {
              bloomsRef.current[at] = element;
            }}
            className={
              isDrifting && prefersReducedMotion !== true
                ? 'flux-bloom flux-bloom--drift'
                : 'flux-bloom'
            }
            style={{
              background: paint(heldRef.current[at] ?? light, at),
              animationDuration: DRIFTS[at] ?? '40s',
            }}
          />
        ))}

        {hasGrid ? <DotField /> : null}
      </div>

      <span className="flux-mood-fade" />
    </div>
  );
};

MoodBackground.displayName = 'MoodBackground';

export { MoodBackground };
