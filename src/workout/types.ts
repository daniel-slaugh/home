/**
 * Every deck uses the same five suits, so cards from different decks can be
 * mixed into one hand: one card per suit, in this order.
 */
export const SUITS = ['legs', 'push', 'pull', 'hinge', 'core'] as const
export type Suit = (typeof SUITS)[number]

export interface Card {
  /** Unique within its deck. Saved in the browser, so don't rename casually. */
  id: string
  suit: Suit
  name: string
  /** Reps, time or sets, e.g. '10–15' or '2 × 30 sec'. */
  reps: string
  cue: string
  easier: string
  harder: string
}

/**
 * How a deck looks. Each deck carries its own art: the card back, the tuck box
 * it lives in on the picker, and the lettering on its box and card faces.
 *
 * Colours and backgrounds are plain CSS values, so a back can be a CSS pattern
 * now and artwork later, e.g.
 *   import backArt from './my-deck/back.png'
 *   back: { background: `url(${backArt.src}) center / cover`, border: '#fffdfa' }
 */
export interface DeckArt {
  back: {
    /** CSS `background` for the back of every card in the deck. */
    background: string
    /** The white (or not) margin printed around the back design. */
    border: string
  }
  box: {
    /** Main colour of the tuck box. */
    color: string
    /** Colour of the deck name on the box's label. */
    ink: string
    /** Label plate behind the deck name. */
    label: string
  }
  lettering: {
    /** CSS font-family for the box title and the card indices and reps. */
    font: string
    /** Stylesheet that loads that font (Google Fonts link), if it isn't loaded already. */
    href?: string
    /** Size of the card indices and reps relative to the default (1). Wide fonts look better around 0.75. */
    scale?: number
  }
  /** The front of every card in the deck. */
  face: {
    /** CSS `background` for the card face. */
    background: string
    /** Exercise name and main text. */
    text: string
    /** Coaching cue and easier/harder lines. */
    muted: string
    /** The thin frame printed inside the card edge. */
    line: string
    /** Reps. */
    accent: string
  }
  /** Suit colours on the card faces (indices and the big centre pip). */
  suits: {
    red: string
    black: string
    /** The core (★) suit. */
    star: string
  }
}

export interface Deck {
  /** Unique across decks. Saved in the browser, so don't rename casually. */
  id: string
  name: string
  /** One line about the deck. */
  blurb: string
  /** What you need, e.g. 'No equipment' or 'One kettlebell'. */
  gear: string
  art: DeckArt
  cards: Card[]
}
