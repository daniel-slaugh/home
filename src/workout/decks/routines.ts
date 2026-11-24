import type { DeckArt, Suit } from '../types'

export type RoutinePhase = 'warm' | 'cool'

type RoutineCard = { id: string; name: string; suit: Suit; moves: readonly string[] }
type RoutineDeck = { art: DeckArt; cards: readonly RoutineCard[] }

export const ROUTINE_DECKS = {
  warm: {
    art: {
      back: {
        background: 'repeating-linear-gradient(45deg, #ffffff24 0 2px, transparent 2px 11px), repeating-linear-gradient(-45deg, #ffffff24 0 2px, transparent 2px 11px), #257044',
        border: '#fff6df',
      },
      box: { color: '#257044', ink: '#184b31', label: '#fff6df' },
      lettering: { font: "'Big Shoulders Display', Impact, sans-serif" },
      face: {
        background: 'radial-gradient(130% 90% at 50% 0%, #2b7548, #143d2a)',
        text: '#fff6df',
        muted: '#e3efdc',
        line: '#e0bc71',
        accent: '#ffda83',
      },
      suits: { red: '#ffbc96', black: '#fff6df', star: '#ffda83' },
    },
    cards: [
      { id: 'easy-start', name: 'Easy start', suit: 'legs', moves: ['March in place', 'Side steps with arm swings', 'Shallow bodyweight squats'] },
      { id: 'hips-in-motion', name: 'Hips in motion', suit: 'hinge', moves: ['Walk or march in place', 'Alternating heel taps', 'Slow bodyweight hip hinges'] },
      { id: 'reach-and-step', name: 'Reach and step', suit: 'pull', moves: ['March with easy arm swings', 'Side steps with forward reaches', 'Alternating knee lifts'] },
      { id: 'light-on-your-feet', name: 'Light on your feet', suit: 'core', moves: ['Easy step-touches', 'March with alternating reaches', 'Heel raises with a slow lower'] },
    ],
  },
  cool: {
    art: {
      back: {
        background: 'repeating-linear-gradient(0deg, #ffffff20 0 1px, transparent 1px 8px), repeating-linear-gradient(90deg, #ffffff20 0 1px, transparent 1px 8px), #21575b',
        border: '#e9f6ed',
      },
      box: { color: '#21575b', ink: '#153e42', label: '#e9f6ed' },
      lettering: { font: "'Big Shoulders Display', Impact, sans-serif" },
      face: {
        background: 'radial-gradient(130% 90% at 50% 0%, #28676b, #16393f)',
        text: '#f0f9f1',
        muted: '#d6efeb',
        line: '#87beb3',
        accent: '#aff0db',
      },
      suits: { red: '#f7ceaf', black: '#f0f9f1', star: '#aff0db' },
    },
    cards: [
      { id: 'ease-down', name: 'Ease down', suit: 'legs', moves: ['Walk slowly in place', 'Shoulder rolls with easy breaths'] },
      { id: 'let-go', name: 'Let go', suit: 'pull', moves: ['Slow steps with relaxed arms', 'Gently open and lower your arms'] },
      { id: 'slow-and-steady', name: 'Slow and steady', suit: 'hinge', moves: ['Gentle step-touches', 'Standing heel-to-toe rocks'] },
      { id: 'catch-your-breath', name: 'Catch your breath', suit: 'core', moves: ['Easy laps around the room', 'Stand tall and breathe slowly'] },
    ],
  },
} satisfies Record<RoutinePhase, RoutineDeck>

export function drawRoutine(phase: RoutinePhase, except?: string) {
  const deck = ROUTINE_DECKS[phase]
  const available = deck.cards.map((card, i) => ({ deck, card, number: i + 1 })).filter(({ card }) => card.id !== except)
  return available[Math.floor(Math.random() * available.length)]
}

export function findRoutine(phase: RoutinePhase, id?: string) {
  const deck = ROUTINE_DECKS[phase]
  const index = deck.cards.findIndex((card) => card.id === id)
  return index === -1 ? undefined : { deck, card: deck.cards[index], number: index + 1 }
}
