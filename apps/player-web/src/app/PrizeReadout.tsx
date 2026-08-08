import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject
} from "react";
import { GiftShadow, StarIcon } from "./icons";
import type { StarFlightState } from "../world/starArrival";

/** How long a landing is marked for, so the flare reads as one beat. */
export const FLARE_MS = 420;

/**
 * True for one beat after each landing.
 *
 * Driven by the running total rather than by a boolean, because what the total
 * buys is where the beat ends: a star landing while the corner is already
 * flaring pushes the settling out to `FLARE_MS` past the *last* landing rather
 * than the first, so the pop lasts as long as the flight does instead of dying
 * under it. Against a stagger this much shorter than `FLARE_MS`, that is one
 * pop per flight by construction, which is the one a child can actually see.
 *
 * A change in the total, never the total itself, because a mount is not a
 * landing. The world is unmounted for the whole ceremony and comes back holding
 * the count it left with — flaring on that would spend the pop before the first
 * star is in the air, and every landing after it would set a flag that was
 * already `true`, which transitions nothing. Every finish after a child's first
 * would arrive at a corner that no longer moves.
 */
function useFlare(landings: number): boolean {
  const [flaring, setFlaring] = useState(false);
  const previous = useRef(landings);
  useEffect(() => {
    if (landings === previous.current) return undefined;
    previous.current = landings;
    setFlaring(true);
    const timer = window.setTimeout(() => setFlaring(false), FLARE_MS);
    return () => window.clearTimeout(timer);
  }, [landings]);
  return flaring;
}

/**
 * How close the child is to the next regalo.
 *
 * The one readout on the world screen. A lifetime total used to sit beside it,
 * and two numbers in one corner is one too many for a child of three who reads
 * neither: what a child at this age can actually use is the one that says how
 * much further.
 *
 * Two things in two corners, because they answer two questions. What a child
 * has is a count of letriestrellas, and it sits top-right where the readout has
 * always been. What they are working towards is the gift, and the ring closing
 * around it sits bottom-left, out of the way of both the avatar above it and
 * the animals opposite — directly above the gift already won, when there is
 * one, because "what is coming" belongs over "what is here".
 *
 * Which is why these are two components and not one. They are rendered into
 * two different places on the screen: `PrizeCount` into its own corner, and
 * `PrizeRing` into the reward column that the waiting gift shares.
 *
 * A ring rather than a bar, and no second number. "24 / 30" asks a pre-reader
 * to hold two figures and divide them; a ring three-quarters round says the
 * same thing in the one language they already have, and the goal it is measured
 * against never has to be read at all. It is still stated on the element, so a
 * screen reader gets the whole sentence — once, from the meter, which is why
 * the count opposite is hidden from it.
 *
 * Inside the ring is the gift itself, as a shadow: what the ring is filling
 * towards, drawn as the thing rather than named as a number. It arrives in
 * colour on the gift screen, and the shadow is the promise of that arrival.
 * Nothing is drawn behind it — the shadow and the gold arc are the whole
 * picture, and a disc under them would only be a second shape to read.
 *
 * Neither half exists before the first letriestrella. "0" is a fact only a
 * reader can take, and an empty ring around a gift nobody has started earning
 * is a promise made to a child who has not asked for one yet. The whole readout
 * arrives with the first star, which makes its appearance part of the reward.
 *
 * Display only, and that is what keeps the reach-band rule intact: neither half
 * is a thing to press, so neither competes with the bar for the band where
 * hands land. They live on the world alone, because a meter filling beside a
 * running game is a second thing to watch.
 *
 * Both halves draw `shown` rather than what the child has earned. The two part
 * company for about a second after a finish, while the stars are still on their
 * way here — see `src/world/starArrival.ts`. `role="meter"` is polled rather
 * than announced, so that lag is invisible to a screen reader and there is no
 * need for a second number.
 */
export function PrizeCount({
  shown,
  arriving,
  landings,
  pill
}: {
  shown: number;
  /** Stars are in the air, so the pill must be laid out for them to aim at. */
  arriving: boolean;
  landings: number;
  pill: RefObject<HTMLParagraphElement | null>;
}) {
  const flaring = useFlare(landings);

  /* Nothing yet, and nothing on its way: nothing to show. */
  if (shown === 0 && !arriving) return null;

  return (
    /*
      Hidden from a screen reader, not because it says nothing but because the
      ring says it already, and in fuller words.

      The number first, then what it counts: "3 letriestrellas", the way it is
      said aloud, rather than a label with a figure hung off it.
    */
    <p
      ref={pill}
      className="prize-count"
      aria-hidden="true"
      data-waiting={shown === 0 ? "" : undefined}
      data-flaring={flaring ? "" : undefined}
    >
      {shown}
      <span className="prize-count__star">
        <StarIcon />
      </span>
    </p>
  );
}

export function PrizeRing({
  shown,
  goal,
  landings
}: {
  shown: number;
  goal: number;
  landings: number;
}) {
  const flaring = useFlare(landings);

  if (shown === 0) return null;

  /* Whole percent, because the ring is drawn in hundredths of its own path. */
  const percentFilled = Math.round((shown / goal) * 100);
  return (
    <section
      className="prize-meter"
      /*
        One step of the arc lasts exactly one stagger, handed to the stylesheet
        from the constant that spaces the landings so the two cannot drift. A
        step that outlived the gap to the next star would blend three landings
        into one continuous sweep, which is the thing the ring is here not to
        be: it follows each star in, one step per arrival.
      */
      style={
        {
          "--prize-step": `${STAR_STAGGER_MS}ms`
        } as CSSProperties
      }
      role="meter"
      aria-label="Letriestrellas hacia el próximo regalo"
      aria-valuenow={shown}
      aria-valuemin={0}
      aria-valuemax={goal}
      data-flaring={flaring ? "" : undefined}
    >
      {/*
        Decoration: the meter itself already states the fill and the goal, and
        a screen reader reading the ring as well would say it twice.

        `pathLength="100"` makes the dash array a percentage regardless of the
        radius, so the geometry can be retuned without recomputing anything —
        and the ring starts at twelve o'clock, which is where a child watching
        something fill expects it to start.
      */}
      <svg className="prize-meter__ring" viewBox="0 0 48 48" aria-hidden="true">
        <circle
          className="prize-meter__fill"
          cx="24"
          cy="24"
          r="21"
          pathLength="100"
          strokeDasharray={`${percentFilled} ${100 - percentFilled}`}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="prize-meter__gift" aria-hidden="true">
        <GiftShadow />
      </span>
    </section>
  );
}

/** Between one star setting off and the next. Three stars, three beats. */
export const STAR_STAGGER_MS = 110;
/** How long one star is on its way. */
export const STAR_TRAVEL_MS = 520;
/** How far apart the stars start, so three do not leave as one. */
const STAR_SPREAD_PX = 56;
/** Where they set off from: the middle, a little high, where the award was. */
const ORIGIN_HEIGHT = 0.42;

/**
 * The letriestrellas on their way to the corner.
 *
 * Mounted with the world and nothing else, which is what makes its mount the
 * signal that the world is on screen: `onArrive` is the whole of how the
 * reducer learns that, and `App` never has to restate the order the screens
 * come in.
 *
 * The pill is measured rather than derived. Its position is stated once, in the
 * stylesheet, in `clamp()`s that depend on the viewport — reading it back out
 * here in TypeScript would be a second copy of a geometry that is free to
 * change.
 */
export function StarFlight({
  flight,
  pill,
  onArrive,
  onLanded
}: {
  flight: StarFlightState | null;
  pill: RefObject<HTMLParagraphElement | null>;
  onArrive: () => void;
  onLanded: () => void;
}) {
  /*
   * Called, not handed over: an effect body's return value is its destructor,
   * and `() => void` accepts a caller that returns something. Wrapping it keeps
   * a future `onArrive` with a return value from silently becoming cleanup.
   */
  useEffect(() => {
    onArrive();
  }, [onArrive]);

  if (flight === null) return null;

  /*
   * Keyed by the flight, so one flight's stars are one stable list. Without
   * the key a second flight would reuse the first's elements, inheriting the
   * transforms they had already reached.
   */
  return (
    <Flight
      key={flight.id}
      count={flight.count}
      pill={pill}
      onLanded={onLanded}
    />
  );
}

function Flight({
  count,
  pill,
  onLanded
}: {
  count: number;
  pill: RefObject<HTMLParagraphElement | null>;
  onLanded: () => void;
}) {
  const [course, setCourse] = useState<{
    readonly originX: number;
    readonly originY: number;
    readonly targetX: number;
    readonly targetY: number;
  } | null>(null);
  const [flying, setFlying] = useState(false);

  /*
   * A flight's timers are scheduled once, when it sets off, and must not
   * restart when a caller re-renders with a new `onLanded` identity — stars
   * that have already landed would land a second time. The ref lets the
   * scheduling effect below depend on `count` alone while still calling
   * whichever `onLanded` is current when a timer fires.
   */
  const onLandedRef = useRef(onLanded);
  useEffect(() => {
    onLandedRef.current = onLanded;
  }, [onLanded]);

  useLayoutEffect(() => {
    const box = pill.current?.getBoundingClientRect();
    /* No pill to aim at means no course, and no course means nothing drawn. */
    if (box === undefined) return undefined;

    setCourse({
      originX: window.innerWidth / 2,
      originY: window.innerHeight * ORIGIN_HEIGHT,
      targetX: box.left + box.width / 2,
      targetY: box.top + box.height / 2
    });

    /* One frame at the origin, so there is something to transition from. */
    const frame = window.requestAnimationFrame(() => setFlying(true));
    return () => window.cancelAnimationFrame(frame);
  }, [pill]);

  useEffect(() => {
    const timers = Array.from({ length: count }, (_unused, index) =>
      window.setTimeout(
        () => onLandedRef.current(),
        index * STAR_STAGGER_MS + STAR_TRAVEL_MS
      )
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [count]);

  /*
   * Nothing to draw until there is somewhere to draw it, and nothing at all if
   * that never comes: stars with no course would stack in the top-left corner
   * of the screen, which is a defect rather than a degradation. The landings
   * above are unaffected, so the counter still reaches the truth — what is lost
   * is the decoration, never the number.
   */
  if (course === null) return null;

  return (
    <div
      className="star-flight"
      aria-hidden="true"
      style={
        {
          "--star-travel": `${STAR_TRAVEL_MS}ms`
        } as CSSProperties
      }
    >
      {Array.from({ length: count }, (_unused, index) => {
        const spread = (index - (count - 1) / 2) * STAR_SPREAD_PX;
        const startX = course.originX + spread;
        const across = flying ? course.targetX - startX : 0;
        const up = flying ? course.targetY - course.originY : 0;
        const delay = `${index * STAR_STAGGER_MS}ms`;
        return (
          /*
            Two elements, one star. The outer one carries it sideways at a
            constant rate and the inner one lifts it with a curve of its own,
            which is what makes the path an arc rather than a diagonal — and
            both are transforms, so nothing here touches layout.
          */
          <span
            key={index}
            className="star-flight__star"
            style={{
              left: `${startX}px`,
              top: `${course.originY}px`,
              transitionDelay: delay,
              transform: `translateX(${across}px)`
            }}
          >
            <span
              className="star-flight__lift"
              style={{
                transitionDelay: delay,
                transform: `translateY(${up}px) scale(${flying ? 0.42 : 1})`
              }}
            >
              <StarIcon />
            </span>
          </span>
        );
      })}
    </div>
  );
}
