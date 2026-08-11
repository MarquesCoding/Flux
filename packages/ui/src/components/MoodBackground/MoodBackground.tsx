import { useReducedMotion } from 'motion/react'
import DotFieldModule from '@FluxUI/DotField'
import type { MoodBackgroundProps } from './MoodBackground.types'

const { DotField } = DotFieldModule

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
 * The lights change in place rather than being swapped for new ones. A frame
 * of a film is read several times a second, and a page that crossfaded two
 * whole layers at that rate would spend its life halfway between two washes.
 * What arrives here has already been eased towards the picture by whatever is
 * reading it; the short transition on each gradient only covers the gap
 * between one reading and the next.
 */
const MoodBackground = ({
  lights = [],
  hasGrid = false,
  isDrifting = false,
}: MoodBackgroundProps) => {
  const prefersReducedMotion = useReducedMotion()
  const lit = lights.filter((light) => light.color !== '')

  return (
    <div role="presentation" className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0">
        {lit.slice(0, BLOOMS.length).map((light, at) => {
          const bloom = BLOOMS[at] ?? BLOOMS[0]

          return (
            <span
              key={`bloom-${at.toString()}`}
              className={
                isDrifting && prefersReducedMotion !== true
                  ? 'flux-bloom flux-bloom--drift'
                  : 'flux-bloom'
              }
              style={{
                background: `radial-gradient(${bloom.size} at ${light.at ?? bloom.at}, color-mix(in oklab, ${light.color} ${bloom.strength.toString()}%, transparent), transparent 70%)`,
                animationDuration: DRIFTS[at] ?? '40s',
                transitionDuration: prefersReducedMotion === true ? '0ms' : undefined,
              }}
            />
          )
        })}

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
