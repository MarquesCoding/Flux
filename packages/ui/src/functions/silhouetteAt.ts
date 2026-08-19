const BPM = 138;

const BEAT = 60 / BPM;

const BAR = BEAT * 4;

const ASPECT = 4 / 3;

const SOFT = 0.007;

const BLADES = 6;

const BANDS = 26;

/**
 * How far a point is from a line drawn between two others, treating the line as having ends rather
 * than running on forever, which is what makes a limb a limb and not a ray.
 *
 * @param px - Where the point is, across.
 * @param py - Where the point is, down.
 * @param ax - Where the line starts, across.
 * @param ay - Where the line starts, down.
 * @param bx - Where the line ends, across.
 * @param by - Where the line ends, down.
 * @returns The distance.
 */
const toLimb = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const along =
    length === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / length));

  return Math.hypot(px - (ax + dx * along), py - (ay + dy * along));
};

/**
 * Turns a distance into ink, dark inside the shape and clear outside it, with the change happening
 * over a fraction of a dot rather than instantly. The film is one bit, but a hard edge crawls as it
 * moves across the grid, and half a dot of softness costs nothing and stops it.
 *
 * @param distance - How far the point is from the shape.
 * @param radius - How thick the shape is.
 * @returns How lit the point is, from nothing to one.
 */
const inked = (distance: number, radius: number): number =>
  Math.min(1, Math.max(0, (radius - distance) / SOFT + 0.5));

/**
 * Turns a field of numbers into ink wherever it rises above a level, softened by how quickly the
 * field changes so that the edge stays half a dot wide however steep the field is.
 *
 * @param value - What the field reads here.
 * @param level - The level it has to reach to be lit.
 * @param steepness - How fast the field changes over a unit of the stage.
 * @returns How lit the point is, from nothing to one.
 */
const over = (value: number, level: number, steepness: number): number =>
  inked((level - value) / steepness, 0);

/**
 * Where a limb ends, given where it starts, which way it points and how long it is. Angles are
 * measured from straight down, so a resting arm is zero and the numbers below read as poses.
 *
 * @param x - Where the limb starts, across.
 * @param y - Where the limb starts, down.
 * @param angle - Which way it points, in radians from straight down.
 * @param length - How long it is.
 * @returns The far end, across and down.
 */
const jointAt = (x: number, y: number, angle: number, length: number): [number, number] => [
  x + Math.sin(angle) * length,
  y + Math.cos(angle) * length,
];

/**
 * Draws the dancer: a head, a body and four limbs swung from a beat. Everything is a rounded line,
 * which is the whole trick — at this resolution a handful of thick lines reads as a person, and a
 * person in flat black is the only thing a two-state display can really carry.
 *
 * @param u - Where the point is, across, from the middle of the stage.
 * @param v - Where the point is, down, from the middle of the stage.
 * @param beats - How many beats have passed.
 * @returns How lit the point is, from nothing to one.
 */
const danceAt = (u: number, v: number, beats: number): number => {
  const swing = Math.sin(beats * Math.PI);
  const bob = Math.abs(Math.sin(beats * Math.PI)) * -0.014;
  const lean = Math.sin(beats * Math.PI * 0.25) * 0.1;

  const x = u * Math.cos(lean) - v * Math.sin(lean);
  const y = u * Math.sin(lean) + v * Math.cos(lean);

  const hipY = 0.07 + bob;
  const shoulderY = -0.11 + bob;

  const rightUpper = 1.1 + 0.55 * swing;
  const leftUpper = -1.1 + 0.55 * swing;
  const [rightElbowX, rightElbowY] = jointAt(0.03, shoulderY, rightUpper, 0.095);
  const [rightHandX, rightHandY] = jointAt(
    rightElbowX,
    rightElbowY,
    rightUpper + 0.8 + 0.6 * swing,
    0.09,
  );
  const [leftElbowX, leftElbowY] = jointAt(-0.03, shoulderY, leftUpper, 0.095);
  const [leftHandX, leftHandY] = jointAt(
    leftElbowX,
    leftElbowY,
    leftUpper - 0.8 + 0.6 * swing,
    0.09,
  );

  const rightThigh = 0.3 * swing;
  const leftThigh = -0.3 * swing;
  const [rightKneeX, rightKneeY] = jointAt(0.025, hipY, rightThigh, 0.115);
  const [rightFootX, rightFootY] = jointAt(
    rightKneeX,
    rightKneeY,
    rightThigh + 0.7 * Math.min(0, rightThigh),
    0.11,
  );
  const [leftKneeX, leftKneeY] = jointAt(-0.025, hipY, leftThigh, 0.115);
  const [leftFootX, leftFootY] = jointAt(
    leftKneeX,
    leftKneeY,
    leftThigh + 0.7 * Math.min(0, leftThigh),
    0.11,
  );

  return Math.max(
    inked(Math.hypot(x, y - (shoulderY - 0.105)), 0.058),
    inked(toLimb(x, y, 0, shoulderY, 0, hipY), 0.052),
    inked(toLimb(x, y, 0.03, shoulderY, rightElbowX, rightElbowY), 0.028),
    inked(toLimb(x, y, rightElbowX, rightElbowY, rightHandX, rightHandY), 0.024),
    inked(toLimb(x, y, -0.03, shoulderY, leftElbowX, leftElbowY), 0.028),
    inked(toLimb(x, y, leftElbowX, leftElbowY, leftHandX, leftHandY), 0.024),
    inked(toLimb(x, y, 0.025, hipY, rightKneeX, rightKneeY), 0.034),
    inked(toLimb(x, y, rightKneeX, rightKneeY, rightFootX, rightFootY), 0.028),
    inked(toLimb(x, y, -0.025, hipY, leftKneeX, leftKneeY), 0.034),
    inked(toLimb(x, y, leftKneeX, leftKneeY, leftFootX, leftFootY), 0.028),
  );
};

/**
 * Squashes the stage sideways so the dancer reads as turning on the spot. A silhouette has no far
 * side to show, so a turn is a width and nothing else — which is exactly the sort of thing that
 * only works because the picture is a silhouette in the first place.
 *
 * @param beats - How many beats have passed.
 * @returns How wide the dancer is, as a fraction of facing forwards.
 */
const turnAt = (beats: number): number =>
  0.34 + 0.66 * Math.abs(Math.cos(beats * Math.PI * 0.0625));

/**
 * Rings leaving the middle of the stage, one on every beat, thin enough that the picture never
 * turns mostly light.
 *
 * @param u - Where the point is, across, from the middle of the stage.
 * @param v - Where the point is, down, from the middle of the stage.
 * @param beats - How many beats have passed.
 * @returns How lit the point is, from nothing to one.
 */
const ringsAt = (u: number, v: number, beats: number): number => {
  const away = Math.hypot(u, v);
  const newest = beats - Math.floor(beats);
  let lit = 0;

  for (let ring = 0; ring < 3; ring += 1) {
    lit = Math.max(lit, inked(Math.abs(away - (newest + ring) * 0.17), 0.011));
  }

  return lit;
};

/**
 * The opening shot: a dot that grows on the first beat and then throws rings, which is a title card
 * for a film that has no title.
 *
 * @param u - Where the point is, across, from the middle of the stage.
 * @param v - Where the point is, down, from the middle of the stage.
 * @param beats - How many beats have passed since this shot began.
 * @returns How lit the point is, from nothing to one.
 */
const openAt = (u: number, v: number, beats: number): number => {
  const away = Math.hypot(u, v);
  const grown = Math.min(1, beats / 2) ** 0.5;
  const pulse = 1 + 0.12 * Math.cos((beats % 1) * Math.PI);

  return Math.max(inked(away, 0.11 * grown * pulse), ringsAt(u, v, beats));
};

/**
 * Blades turning around the middle of the stage inside a disc that opens and closes on the beat.
 * The pattern is the sort of thing an oscilloscope draws, which is the company this film is keeping.
 *
 * @param u - Where the point is, across, from the middle of the stage.
 * @param v - Where the point is, down, from the middle of the stage.
 * @param beats - How many beats have passed since this shot began.
 * @returns How lit the point is, from nothing to one.
 */
const bladesAt = (u: number, v: number, beats: number): number => {
  const away = Math.hypot(u, v);
  const around = Math.atan2(v, u) + beats * 0.38;
  const reach = 0.3 + 0.13 * Math.abs(Math.sin(beats * Math.PI * 0.5));
  const blade = over(Math.sin(around * BLADES) * away, 0, 1);

  return Math.min(blade, inked(away, reach)) + Math.min(1 - blade, inked(away, 0.075));
};

/**
 * The dancer turning on the spot with rings passing through, the rings inverting whatever they
 * cross rather than sitting on top of it. Inversion is free on a display with two states and it is
 * the one effect that looks wrong anywhere else.
 *
 * @param u - Where the point is, across, from the middle of the stage.
 * @param v - Where the point is, down, from the middle of the stage.
 * @param beats - How many beats have passed since this shot began.
 * @returns How lit the point is, from nothing to one.
 */
const hauntAt = (u: number, v: number, beats: number): number => {
  const turned = turnAt(beats);
  const figure = danceAt(u / turned, v, beats);

  return Math.abs(figure - ringsAt(u, v, beats));
};

/**
 * Bands flowing across the stage, bent by a wave running the other way. Two crossed sines, which is
 * as close as this film gets to drawing its own name.
 *
 * @param u - Where the point is, across, from the middle of the stage.
 * @param v - Where the point is, down, from the middle of the stage.
 * @param beats - How many beats have passed since this shot began.
 * @returns How lit the point is, from nothing to one.
 */
const wavesAt = (u: number, v: number, beats: number): number => {
  const bend = Math.sin(u * 3.6 + beats * 0.45) * 1.9;
  const band = Math.sin(v * BANDS + bend + beats * 1.6);

  return over(band, 0.5, BANDS);
};

/**
 * The last shot: the dancer shrinking to the dot she grew out of, and then nothing.
 *
 * @param u - Where the point is, across, from the middle of the stage.
 * @param v - Where the point is, down, from the middle of the stage.
 * @param beats - How many beats have passed since this shot began.
 * @returns How lit the point is, from nothing to one.
 */
const closeAt = (u: number, v: number, beats: number): number => {
  const left = Math.max(0, 1 - beats / 9);
  const away = Math.hypot(u, v);

  if (left <= 0.12) {
    return inked(away, 0.11 * (left / 0.12));
  }

  return Math.max(danceAt(u / left, v / left, beats), ringsAt(u, v, beats));
};

const SHOTS = [
  { bars: 4, at: openAt },
  { bars: 8, at: danceAt },
  { bars: 4, at: bladesAt },
  { bars: 8, at: hauntAt },
  { bars: 4, at: wavesAt },
  { bars: 3, at: closeAt },
] as const;

const SILHOUETTE_SECONDS = SHOTS.reduce((total, shot) => total + shot.bars * BAR, 0);

/**
 * How lit one point of the film is at one moment: a Flux original, drawn rather than fetched, so
 * that the easter egg ships as a few sines and no footage at all. Cuts between shots land on bar
 * lines, which is the whole of the editing.
 *
 * @param x - Where the point is across the frame, from nothing at the left to one at the right.
 * @param y - Where the point is down the frame, from nothing at the top to one at the bottom.
 * @param seconds - How far into the film it is.
 * @returns How lit the point is, from nothing to one.
 */
const silhouetteAt = (x: number, y: number, seconds: number): number => {
  const u = (x - 0.5) * ASPECT;
  const v = y - 0.5;
  let began = 0;

  for (const shot of SHOTS) {
    const length = shot.bars * BAR;

    if (seconds < began + length) {
      return shot.at(u, v, (seconds - began) / BEAT);
    }

    began += length;
  }

  return 0;
};

export { silhouetteAt, SILHOUETTE_SECONDS };
