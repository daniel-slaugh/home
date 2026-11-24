/**
 * The deck registry. To add a deck:
 *   1. Copy bodyweight.ts to a new file and replace its id, name, blurb, gear, art and cards.
 *      Give it at least one card in every suit (legs, push, pull, hinge, core).
 *      `art` sets the card back, the tuck box and the lettering (see DeckArt in ../types.ts).
 *      Artwork files can sit next to the deck, e.g. decks/kettlebell/back.png.
 *   2. Import it here and add it to DECKS.
 * The workout page picks it up automatically, including any font in art.lettering.href.
 */
import type { Deck } from '../types'
import { bodyweight } from './bodyweight'
import { cardio } from './cardio'

export const DECKS: Deck[] = [bodyweight, cardio]
