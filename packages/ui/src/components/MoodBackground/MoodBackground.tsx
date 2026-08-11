import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import DotFieldModule from '@FluxUI/DotField'
import blendLightsModule from '@FluxUI/blendLights'
import type { MoodBackgroundProps, MoodLight } from './MoodBackground.types'

const { DotField } = DotFieldModule
const { blendLights } = blendLightsModule

/**
 * Where a light sits when it has not said, how large it is, and how much of it
 * there is.
 *
 * Fixed places rather than random ones: a wash is a composition, and one that
 * lands somewhere different every time an item changes reads as a fault. Sized
 * in viewport units so the same shapes hold on a phone and on a television.
 */
const BLOOMS = [
  { at: '14% 8%', size: '70vw 60vh', strength: 40 },
  { at: '86% 12%', size: '65vw 55vh', strength: 36 },
  { at: '10% 84%', size: '70vw 55vh', strength: 30 },
  { at: '90% 86%', size: '65vw 55vh', strength: 28 },
  { at: '50% 45%', size: '80vw 60vh', strength: 24 },
] as const

/**
 * How long each takes to wander its circuit.
 *
 * Different lengths on purpose: lights moving in step read as one light in
 * several places.
 */
const DRIFTS = ['34s', '46s', '58s', '41s', '52s'] as const

/**
 * The light a page is under when nothing on it has any to give.
 *
 * The house colour, in the same places as everything else, so a page of
 * results or a form is lit rather than flat — and so navigating off a film
 * eases back to it instead of holding that film's light over a page it has
 * nothing to do with. One per place, so the way back is the same easing as the
 * way there rather than a swap.
 */
const HOUSE = [
  'rgb(56 68 150)',
  'rgb(48 60 138)',
  'rgb(44 54 124)',
  'rgb(50 62 142)',
  'rgb(40 50 118)',
] as const

const DEFAULT_LIGHTS: MoodLight[] = HOUSE.map((color) => ({ color }))

/**
 * How far the light moves towards where it is going, each frame.
 *
 * Three hundredths, sixty times a second: about half a second to cover most of
 * a change, and no single step large enough to see. The size of a step is the
 * whole question here — a wash that arrives in a few large ones is a wash that
 * flickers, however slowly it gets there.
 */
const EASE = 0.03

/**
 * How the light for one bloom is written.
 */
const paint = (light: MoodLight, at: number): string => {
  const bloom = BLOOMS[at] ?? BLOOMS[0]

  return `radial-gradient(${bloom.size} at ${light.at ?? bloom.at}, color-mix(in oklab, ${light.color} ${bloom.strength.toString()}%, transparent), transparent 70%)`
}

/**
 * The light a page is under.
 *
 * Taken from what is on screen — each corner of the picture read on its own —
 * rather than from one colour decided in advance, so the page looks like the
 * picture is spilling onto it rather than sitting on a coloured card.
 *
 * Kept well below the artwork it came from: the point is that a room feels
 * like the film is on, and a wash strong enough to notice is a wash competing
 * with the thing it came from.
 *
 * What arrives is where the light is going rather than where it is. A frame of
 * a film is read a few times a second, and a page painted straight from those
 * readings steps between them. So the colours are carried the rest of the way
 * here, a fraction per frame, written onto the elements directly: this changes
 * sixty times a second, and asking React to redraw the page it sits behind at
 * that rate to move a gradient would cost more than everything else on screen
 * put together.
 */
const MoodBackground = ({
  lights = [],
  hasGrid = false,
  isDrifting = false,
}: MoodBackgroundProps) => {
  const prefersReducedMotion = useReducedMotion()
  const given = lights.filter((light) => light.color !== '')
  const lit = given.length === 0 ? DEFAULT_LIGHTS : given
  const bloomsRef = useRef<(HTMLSpanElement | null)[]>([])
  const heldRef = useRef<MoodLight[]>([])
  const wantedRef = useRef<MoodLight[]>(lit)
  const paintedRef = useRef<string[]>([])

  wantedRef.current = lit

  useEffect(() => {
    // The first light is arrived at rather than eased into. Coming up to it
    // from black would be a wash sliding in from a colour nothing on screen
    // has anything to do with.
    if (heldRef.current.length === 0) {
      heldRef.current = wantedRef.current
    }

    let frame = 0

    const carry = () => {
      const wanted = wantedRef.current

      heldRef.current =
        prefersReducedMotion === true || heldRef.current.length !== wanted.length
          ? wanted
          : blendLights(heldRef.current, wanted, EASE)

      heldRef.current.forEach((light, at) => {
        const element = bloomsRef.current[at]
        const painted = paint(light, at)

        // Only when it has actually moved. Easing settles within a step of
        // where it was going and then stops changing, and writing the same
        // gradient back sixty times a second would keep the browser painting a
        // screen-sized bloom long after it had finished arriving.
        if (element !== null && element !== undefined && paintedRef.current[at] !== painted) {
          paintedRef.current[at] = painted
          element.style.background = painted
        }
      })

      frame = requestAnimationFrame(carry)
    }

    frame = requestAnimationFrame(carry)

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [prefersReducedMotion])

  return (
    <div
      role="presentation"
      // At the top of the page rather than pinned to the screen. Light spilling
      // off a picture belongs to that picture: it should slide away as the page
      // is scrolled past it, not follow the reader down through a grid of
      // artwork it has nothing to do with. Taller than a screen so the fade to
      // the page's own colour finishes below the fold rather than across it.
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[140svh] overflow-hidden"
    >
      <div className="absolute inset-0">
        {lit.slice(0, BLOOMS.length).map((light, at) => (
          <span
            key={`bloom-${at.toString()}`}
            ref={(element) => {
              bloomsRef.current[at] = element
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

        {/* The page's own colour underneath the light, so the foot of the
            screen is the page rather than whatever the picture was made
            of. */}
        <span className="flux-mood-fade" />
      </div>

      {hasGrid ? <DotField /> : null}
    </div>
  )
}

MoodBackground.displayName = 'MoodBackground'

export default { MoodBackground }
