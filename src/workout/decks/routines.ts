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
    /*
      Each warm-up follows the RAMP pattern (Jeffreys): Raise heart rate and muscle temperature,
      Activate and Mobilise the muscles the workout uses with moving stretches, then Potentiate
      with a short burst near workout pace. Stretches here move rather than hold: long static
      holds just before training can blunt strength and power (Behm et al., 2016). Everything
      happens on the spot, in a space about the size of a yoga mat. Four moves a card keeps it
      simple to follow. Every card warms up the whole body, so any card suits any workout.

      The card is all the user sees, so a move is written as what to do, not by a name they might
      not know ("On all fours, reach one arm under you, then up", not "Thread the needle"). Only
      moves everyone knows (jumping jacks, push-ups, squats) go by name.
    */
    cards: [
      {
        id: 'full-body-primer', name: 'Full-body primer', suit: 'legs',
        moves: [['Jog on the spot', 90], ['Walk your hands out to a plank and back', 60], ['Squats and reverse lunges', 120], ['Quick squats at workout pace', 30]],
      },
      {
        id: 'quiet-start', name: 'Quiet start', suit: 'hinge',
        moves: [['High-knee march, then no-jump jacks', 120], ['Lunge, one hand on the floor, other arm up, each side', 60], ['Slow bodyweight squats', 60], ['Easy push-ups, knees down if needed', 60]],
      },
      {
        id: 'wake-up-call', name: 'Wake-up call', suit: 'push',
        moves: [['Jumping jacks', 120], ['On all fours, thread one arm under, then up, each side', 60], ['Alternating reverse lunges', 60], ['In a plank, tap opposite shoulders', 60]],
      },
      {
        id: 'get-moving', name: 'Get moving', suit: 'pull',
        moves: [['Jog, finish with high knees', 120], ['Big arm circles, both ways', 60], ['Side lunges, alternating', 90], ['Squat jumps, soft landings', 30]],
      },
      {
        id: 'head-to-toe', name: 'Head to toe', suit: 'core',
        moves: [['Jog on the spot', 120], ['Squat, then reach both arms overhead', 60], ['Walk your hands out to a plank and back', 90], ['In a plank, run your knees to your chest', 30]],
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
    /*
      Each cool-down lets the heart rate come down gradually with easy movement, then holds
      static stretches while the muscles are warm, about 30 seconds a side (ACSM). Slow
      breathing with long exhales helps the body switch back to rest. A cool-down won't prevent
      next-day soreness, but it eases the shift from hard work to rest and is a good time to
      build flexibility. Every card stretches upper and lower body, so any card suits any
      workout.
    */
    cards: [
      {
        id: 'ease-off', name: 'Ease off', suit: 'legs',
        moves: [['March on the spot, slowing down', 120], ['Pull one heel to your bottom, each side', 60], ['Pull one arm across your chest, each side', 60], ['Kneel, sit back on heels, arms forward, breathe', 60]],
      },
      {
        id: 'wind-down', name: 'Wind down', suit: 'push',
        moves: [['Slow march with shoulder rolls', 120], ['Heel forward, leg straight, lean over, each side', 60], ['Hand on a wall, turn your body away, each side', 60], ['On your back, drop both knees to one side, each side', 60]],
      },
      {
        id: 'settle', name: 'Settle', suit: 'hinge',
        moves: [['Slow side steps', 120], ['Kneel on one knee, push your hips forward, each side', 60], ['Clasp hands behind you, lift your chest', 60], ['On your back, ankle on knee, pull in, each side', 60]],
      },
      {
        id: 'breathe-down', name: 'Breathe down', suit: 'core',
        moves: [['Slow side steps', 60], ['Kneel, sit back on heels, arms forward', 60], ['Sit with legs straight, reach toward your toes', 60], ['Lie on your back, breathe in for 4, out for 6', 120]],
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
