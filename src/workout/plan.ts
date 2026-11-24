import type { Card } from './types'

/**
 * How the cards turn into a timed workout. Every card describes ONE set, and its text
 * never changes; the workout type decides how many times you do it and in what order.
 */
export type WorkoutType = 'circuit' | 'sets' | 'variety'

export const TYPES: { id: WorkoutType; name: string }[] = [
  { id: 'circuit', name: 'Circuit' },
  { id: 'sets', name: 'Sets' },
  { id: 'variety', name: 'Variety' },
]

/** Warm-up and cool-down minutes for each length. */
export const LENGTHS: Record<number, { warm: number; cool: number }> = {
  20: { warm: 3, cool: 1 },
  30: { warm: 4, cool: 2 },
  45: { warm: 5, cool: 3 },
}

/** Sets of each card (Sets) and laps of the circuit (Circuit). Variety does each card once. */
export const SETS = 2
export const LAPS = 2

/**
 * Seconds for one set plus the rest after it. There's no rest timer: you rest when a
 * set is done, and that rest is counted here. Calibrated so a 30-minute workout is
 * 5 cards × 2 sets: (30 − 4 warm-up − 2 cool-down) min ÷ 10 sets = 144 sec.
 */
export const SLOT = 144

const repeatsFor = (type: WorkoutType) => (type === 'sets' ? SETS : type === 'circuit' ? LAPS : 1)

/** How many cards fill a length for this type (never more than the decks hold). */
export function cardCount(type: WorkoutType, len: number, available = Infinity): number {
  const L = LENGTHS[len] ?? LENGTHS[30]
  const slots = ((len - L.warm - L.cool) * 60) / SLOT
  return Math.max(1, Math.min(available, Math.round(slots / repeatsFor(type))))
}

/** A step of the workout. A set's `secs` covers doing it and resting afterwards. */
export type Step = { kind: 'warm' | 'cool'; secs: number } | { kind: 'work'; secs: number; card: number; label: string }

export interface Plan {
  steps: Step[]
  /** One line that says exactly how to do the workout. */
  summary: string
  /** Sets per card (Sets), laps (Circuit), or 1 (Variety). */
  repeat: number
  /** Planned seconds from start to finish. */
  secs: number
  /** Planned minutes from start to finish, rounded. */
  minutes: number
}

export function buildPlan(type: WorkoutType, len: number, cards: Card[]): Plan {
  const L = LENGTHS[len] ?? LENGTHS[30]
  const n = cards.length
  const repeat = repeatsFor(type)
  const steps: Step[] = [{ kind: 'warm', secs: L.warm * 60 }]
  let summary = ''

  if (type === 'circuit') {
    for (let r = 0; r < repeat; r++) cards.forEach((_, i) => steps.push({ kind: 'work', secs: SLOT, card: i, label: `Lap ${r + 1} of ${repeat} · card ${i + 1} of ${n}` }))
    summary = `${repeat} laps through all ${n} cards, one set each.`
  } else if (type === 'sets') {
    cards.forEach((_, i) => {
      for (let k = 0; k < repeat; k++) steps.push({ kind: 'work', secs: SLOT, card: i, label: `Set ${k + 1} of ${repeat}` })
    })
    summary = `${repeat} sets of each card before moving on.`
  } else {
    cards.forEach((_, i) => steps.push({ kind: 'work', secs: SLOT, card: i, label: `Card ${i + 1} of ${n}` }))
    summary = `${n} cards, one set each.`
  }

  steps.push({ kind: 'cool', secs: L.cool * 60 })
  const secs = steps.reduce((t, s) => t + s.secs, 0)
  return { steps, summary, repeat, secs, minutes: Math.round(secs / 60) }
}
