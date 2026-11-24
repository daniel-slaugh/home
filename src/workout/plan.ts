import type { Card } from './types'
import { ROUTINE_MINUTES } from './decks/routines'

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

/** Five minutes per phase is the lower end of the American Heart Association's guidance. */
const ROUTINE_LENGTH = { warm: ROUTINE_MINUTES, cool: ROUTINE_MINUTES }
export const LENGTHS: Record<number, { warm: number; cool: number; cards: number }> = {
  20: { ...ROUTINE_LENGTH, cards: 3 },
  30: { ...ROUTINE_LENGTH, cards: 5 },
  45: { ...ROUTINE_LENGTH, cards: 8 },
}

/** Sets of each card (Sets) and laps of the circuit (Circuit). Variety does each card once. */
export const SETS = 2
export const LAPS = 2

const INTERVAL_SECONDS = 30
/** A Variety card budgets about this much time for its one set and rest. */
const TARGET_SET_SECONDS = 144

const repeatsFor = (type: WorkoutType) => (type === 'sets' ? SETS : type === 'circuit' ? LAPS : 1)
const exerciseSeconds = (length: number) => (length - LENGTHS[length].warm - LENGTHS[length].cool) * 60

/** Exercise cards for the selected mode and length, capped by the available deck. */
export function cardCount(type: WorkoutType, len: number, available = Infinity): number {
  const length = LENGTHS[len] ? len : 30
  const count = type === 'variety' ? Math.round(exerciseSeconds(length) / TARGET_SET_SECONDS) : LENGTHS[length].cards
  return Math.max(1, Math.min(available, count))
}

/** A workout step. Work time accounts for all sets in the step and their rest. */
export type Step = { kind: 'warm' | 'cool'; secs: number } | { kind: 'work'; secs: number; card: number; sets: number }

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
  const length = LENGTHS[len] ? len : 30
  const L = LENGTHS[length]
  const n = cards.length
  const repeat = repeatsFor(type)
  const steps: Step[] = [{ kind: 'warm', secs: L.warm * 60 }]
  const workSets = n * repeat
  const workIntervals = Math.max(workSets, exerciseSeconds(length) / INTERVAL_SECONDS)
  let scheduledSets = 0
  // Round cumulative boundaries so each set gets a whole interval and the rounding doesn't add up.
  const addWork = (card: number, sets = 1) => {
    const start = Math.round((scheduledSets * workIntervals) / workSets)
    scheduledSets += sets
    const end = Math.round((scheduledSets * workIntervals) / workSets)
    steps.push({ kind: 'work', secs: (end - start) * INTERVAL_SECONDS, card, sets })
  }
  let summary = ''

  if (type === 'circuit') {
    for (let r = 0; r < repeat; r++) cards.forEach((_, i) => addWork(i))
    summary = `${repeat} laps through all ${n} cards, one set each.`
  } else if (type === 'sets') {
    cards.forEach((_, i) => addWork(i, repeat))
    summary = `${repeat} sets of each card before moving on.`
  } else {
    cards.forEach((_, i) => addWork(i))
    summary = `${n} cards, one set each.`
  }

  steps.push({ kind: 'cool', secs: L.cool * 60 })
  const secs = steps.reduce((t, s) => t + s.secs, 0)
  return { steps, summary, repeat, secs, minutes: Math.round(secs / 60) }
}
