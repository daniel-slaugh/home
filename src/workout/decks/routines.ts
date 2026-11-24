import type { DeckArt, Suit } from '../types'

export type RoutinePhase = 'warm' | 'cool'
export const ROUTINE_MINUTES = 5

type RoutineMove = readonly [movement: string, seconds: number]
type RoutineCard = { id: string; name: string; suit: Suit; moves: readonly RoutineMove[] }
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
      {
        id: 'easy-start', name: 'Easy start', suit: 'legs',
        moves: [['Easy march', 120], ['Build to a brisk march', 60], ['Side steps with arm swings', 60], ['Slow, shallow squats', 60]],
      },
      {
        id: 'hips-in-motion', name: 'Hips in motion', suit: 'hinge',
        moves: [['Easy walk', 120], ['Gradually quicken your walk', 60], ['Alternating knee lifts', 60], ['Easy bodyweight hip hinges', 60]],
      },
      {
        id: 'reach-and-step', name: 'Reach and step', suit: 'pull',
        moves: [['Easy march with arm swings', 120], ['Build to a brisk march', 60], ['Side steps with forward reaches', 60], ['Easy wall push-ups, pause as needed', 60]],
      },
      {
        id: 'light-on-your-feet', name: 'Light on your feet', suit: 'core',
        moves: [['Easy step-touches', 120], ['Build to quicker side steps', 60], ['Alternating reverse toe taps', 60], ['A few easy reps of the first exercise', 60]],
      },
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
      {
        id: 'ease-down', name: 'Ease down', suit: 'legs',
        moves: [['Walk at an easy pace', 120], ['Gradually slow to a stroll', 120], ['Gentle wall calf stretch, left', 30], ['Gentle wall calf stretch, right', 30]],
      },
      {
        id: 'let-go', name: 'Let go', suit: 'pull',
        moves: [['Easy march with relaxed arms', 120], ['Slow march with smaller steps', 120], ['Gentle shoulder rolls', 60]],
      },
      {
        id: 'slow-and-steady', name: 'Slow and steady', suit: 'hinge',
        moves: [['Easy side steps', 120], ['Slow down as you walk', 120], ['Gentle standing heel-to-toe rocks', 60]],
      },
      {
        id: 'catch-your-breath', name: 'Catch your breath', suit: 'core',
        moves: [['Walk around the room', 120], ['Take slower, shorter steps', 120], ['Stroll and let your breathing settle', 60]],
      },
    ],
  },
} satisfies Record<RoutinePhase, RoutineDeck>

export function drawRoutine(phase: RoutinePhase, except?: string) {
  const deck = ROUTINE_DECKS[phase]
  const available = deck.cards.filter((card) => card.id !== except)
  return { deck, card: available[Math.floor(Math.random() * available.length)] }
}

export function findRoutine(phase: RoutinePhase, id?: string) {
  const deck = ROUTINE_DECKS[phase]
  const card = deck.cards.find((card) => card.id === id)
  return card ? { deck, card } : undefined
}
