import { SUITS, type Card, type Deck, type Suit } from './types'

export interface Dealt {
  deck: Deck
  card: Card
}

type Rand = () => number

const pick = <T>(a: T[], rand: Rand): T => a[Math.floor(rand() * a.length)]

function shuffle<T>(a: T[], rand: Rand): T[] {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Each deck's exact (fractional) share of `slots`. */
export function exactShares(weights: number[], slots: number): number[] {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0)
  if (!total) return weights.map((_, i) => (i === 0 ? slots : 0))
  return weights.map((w) => (Math.max(0, w) / total) * slots)
}

/** For labels: '3' when a deck always gets 3 cards, '2–3' when it depends on the deal. */
export const shareLabel = (exact: number) => {
  const r = Math.round(exact * 1e6) / 1e6
  return Number.isInteger(r) ? String(r) : `${Math.floor(r)}–${Math.ceil(r)}`
}

/** Whole-card shares of `slots` that best match the weights (largest remainder, ties broken at random). */
export function shares(weights: number[], slots: number, rand: Rand = Math.random): number[] {
  const exact = exactShares(weights, slots)
  const out = exact.map((x) => Math.floor(x + 1e-9))
  let left = slots - out.reduce((s, n) => s + n, 0)
  const order = exact.map((x, i) => [Math.round((x - out[i]) * 1e6), rand(), i] as const).sort((a, b) => b[0] - a[0] || b[1] - a[1])
  for (const [, , i] of order) {
    if (!left) break
    out[i]++
    left--
  }
  return out
}

export const cardsIn = (deck: Deck, suit: Suit) => deck.cards.filter((c) => c.suit === suit)

/** A different card of the same suit from the same deck, when there is one. */
export function redrawFrom(deck: Deck, current: Card, rand: Rand = Math.random): Card {
  const pool = cardsIn(deck, current.suit).filter((c) => c.id !== current.id)
  return pool.length ? pick(pool, rand) : current
}

/**
 * One card per suit. Each deck gets a share of the five suits that matches its
 * weight; which suits land with which deck is random. A deck with no card in a
 * suit hands that suit to a deck that has one.
 */
export function dealHand(mix: { deck: Deck; weight: number }[], rand: Rand = Math.random): Dealt[] {
  const used = mix.filter((m) => m.weight > 0)
  const list = used.length ? used : mix.slice(0, 1)
  const counts = shares(
    list.map((m) => m.weight),
    SUITS.length,
    rand
  )
  const owners = shuffle(
    list.flatMap((m, i) => Array(counts[i]).fill(m.deck) as Deck[]),
    rand
  )
  return SUITS.map((suit, i) => {
    let deck = owners[i]
    if (!cardsIn(deck, suit).length) deck = list.map((m) => m.deck).find((d) => cardsIn(d, suit).length) ?? deck
    return { deck, card: pick(cardsIn(deck, suit), rand) }
  })
}
