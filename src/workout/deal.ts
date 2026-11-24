import { SUITS, type Card, type Deck } from './types'

export interface Dealt {
  deck: Deck
  card: Card
}

type Rand = () => number
type Mix = { deck: Deck; weight: number }[]

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

const key = (x: Dealt) => `${x.deck.id}/${x.card.id}`

/** How many different cards the decks hold between them. A hand can't be bigger than this. */
export const uniqueCards = (mix: Mix) => mix.reduce((s, m) => s + m.deck.cards.length, 0)

/**
 * Deal `count` cards with no repeats. Suits come round in order (legs, push, pull,
 * hinge, core, legs, …). Each deck gets a share of the cards that matches its weight;
 * which positions land with which deck is random. When a deck has run out of a suit,
 * another deck covers it, and when every deck has, the next suit that still has cards
 * is used instead.
 */
export function dealHand(mix: Mix, count = SUITS.length, rand: Rand = Math.random, keep: Dealt[] = []): Dealt[] {
  const used = mix.filter((m) => m.weight > 0)
  const list = used.length ? used : mix.slice(0, 1)
  const decks = list.map((m) => m.deck)
  const total = Math.min(count, uniqueCards(list))
  const out = keep.slice(0, total)
  const taken = new Set(out.map(key))
  const counts = shares(
    list.map((m) => m.weight),
    total,
    rand
  )
  // Positions still to fill, shared out between the decks.
  const owners = shuffle(
    list.flatMap((m, i) => Array(counts[i]).fill(m.deck) as Deck[]),
    rand
  ).slice(out.length)
  const free = (d: Deck, suit?: string) => d.cards.filter((c) => (!suit || c.suit === suit) && !taken.has(`${d.id}/${c.id}`))

  for (let i = out.length; i < total; i++) {
    const want = SUITS[i % SUITS.length]
    const owner = owners[i - keep.length] ?? decks[0]
    let deck = owner
    let pool = free(owner, want)
    if (!pool.length) {
      deck = decks.find((d) => free(d, want).length) ?? owner
      pool = free(deck, want)
    }
    if (!pool.length) {
      // No deck has this suit left: take the next suit that still has cards.
      for (let k = 1; k < SUITS.length && !pool.length; k++) {
        const s = SUITS[(i + k) % SUITS.length]
        deck = [owner, ...decks].find((d) => free(d, s).length) ?? owner
        pool = free(deck, s)
      }
    }
    const card = pick(pool, rand)
    out.push({ deck, card })
    taken.add(`${deck.id}/${card.id}`)
  }
  return out
}
