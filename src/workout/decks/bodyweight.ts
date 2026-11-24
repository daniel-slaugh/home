import type { Card, Deck, Suit } from '../types'

const c = (id: string, suit: Suit, name: string, reps: string, cue: string, easier: string, harder: string): Card => ({ id, suit, name, reps, cue, easier, harder })

export const bodyweight: Deck = {
  id: 'bodyweight',
  name: 'Bodyweight',
  blurb: 'Squats, push-ups, rows and planks you can do in the living room.',
  gear: 'No equipment',
  art: {
    // The classic blue card-room back.
    back: {
      background: 'repeating-linear-gradient(45deg, #ffffff2e 0 2px, transparent 2px 11px), repeating-linear-gradient(-45deg, #ffffff2e 0 2px, transparent 2px 11px), #1f3fb4',
      border: '#fffdfa',
    },
    box: { color: '#1f3fb4', ink: '#1a2f8a', label: '#fffdfa' },
    lettering: { font: "'Big Shoulders Display', Impact, sans-serif" },
    face: {
      background: 'radial-gradient(130% 90% at 50% 0%, #2d4ac2, #16286f)',
      text: '#fbf4e4',
      muted: '#cfd7f6',
      line: '#d9b25c',
      accent: '#f2ca6a',
    },
    suits: { red: '#ff9d8f', black: '#fbf4e4', star: '#f2ca6a' },
  },
  cards: [
    c('tsq', 'legs', 'Tempo squat', '10–15 reps', 'Three seconds down, stand up fast. Chest tall, knees track over toes.', 'Squat to the couch', 'Pause 3 sec at the bottom'),
    c('wsit', 'legs', 'Wall sit', '30–45 sec', 'Back flat on the wall, thighs near parallel, weight in the heels.', 'Sit higher on the wall', 'Sit lower'),
    c('psq', 'legs', 'Pulse squat', '12–15 reps', 'Sink to the bottom, rise a few inches, sink again. Never fully stand.', 'Stand between pulses', 'Hug a loaded backpack'),
    c('rlun', 'legs', 'Reverse lunge', '8–10 reps each side', 'Step back, lower the back knee toward the floor, drive up through the front heel.', 'Hand on the wall', 'Hug a loaded backpack'),
    c('bss', 'legs', 'Split squat, back foot on couch', '6–10 reps each side', 'Front foot far enough out that the knee stays over the ankle. Go straight down.', 'Back foot on the floor', '3-second lowering'),
    c('stup', 'legs', 'Step-up', '8–10 reps each side', 'Sturdy bench or bottom stair. Push through the top foot; no bouncing off the bottom one.', 'Lower step', 'Higher step or backpack'),
    c('pu', 'push', 'Push-up', '6–12 reps', 'Body in one straight line, elbows about 45° from your sides, chest to an inch off the floor.', 'Hands on the couch', 'Feet on the couch'),
    c('ipu', 'push', 'Incline push-up', '10–15 reps', 'Hands on the kitchen counter or couch arm. Lower your chest to the edge.', 'Higher surface', 'Lower surface'),
    c('npu', 'push', 'Slow-lowering push-up', '5–8 reps', 'Four seconds down, then push up any way you can, knees included.', 'Lower from your knees', 'Pause 2 sec at the bottom'),
    c('pike', 'push', 'Pike push-up', '6–10 reps', 'Hips high like an upside-down V. Lower the top of your head between your hands.', 'Hands on the couch', 'Feet on the couch'),
    c('dip', 'push', 'Couch dip', '8–12 reps', 'Hands on the couch edge behind you, bend elbows straight back to about 90°. Stop if shoulders complain.', 'Knees bent, feet close', 'Legs straight'),
    c('shp', 'push', 'Shoulder-tap plank', '10 reps each side', 'High plank. Tap the opposite shoulder without letting your hips rock.', 'Feet wide', 'Feet together'),
    c('dfr', 'pull', 'Doorframe row', '10–15 reps', 'Grip both sides of a doorframe, lean back on straight arms, pull your chest to the frame.', 'Stand more upright', 'Feet closer to the frame'),
    c('bpr', 'pull', 'Backpack row', '10–15 reps', 'Load a backpack with books. Hinge forward with a flat back and pull it to your belly button.', 'Fewer books', 'More books, 2-sec squeeze'),
    c('ytw', 'pull', 'Y-T-W raises, face down', '5 reps of each letter', 'Thumbs up. Lift your arms into a Y, then a T, then a W, squeezing the shoulder blades.', 'Smaller range', 'A water bottle in each hand'),
    c('rsa', 'pull', 'Reverse snow angel', '8–10 reps', 'Face down, arms hovering. Sweep hands from overhead to your hips and back without touching down.', 'Rest arms between reps', '2-sec pause at each end'),
    c('sup', 'pull', 'Superman pulldown', '10–12 reps', 'Face down, arms overhead and lifted. Pull elbows to your ribs, squeeze, reach back out.', 'Chest stays on the floor', 'Hold each pull 3 sec'),
    c('gb', 'hinge', 'Glute bridge', '15–20 reps', 'Feet flat, drive hips up through the heels, squeeze 2 seconds at the top. Ribs down.', 'Smaller range', 'Backpack across the hips'),
    c('cht', 'hinge', 'Couch hip thrust', '12–15 reps', 'Shoulder blades on the couch edge. Drive hips up until your body is a tabletop.', 'Glute bridge on the floor', 'Single-leg'),
    c('slb', 'hinge', 'Single-leg glute bridge', '8–12 reps each side', 'One foot planted, the other knee hugged in. Keep the hips level.', 'Both feet, 2-sec squeeze', 'Planted foot on the couch'),
    c('srdl', 'hinge', 'Single-leg Romanian deadlift', '8 reps each side', 'Fingertips on the wall. Hinge, reach the free leg back, flat back, stand tall.', 'Back toes stay down', 'No wall, backpack in hand'),
    c('bgm', 'hinge', 'Backpack good morning', '12–15 reps', 'Backpack hugged to your chest, soft knees. Push hips back until the hamstrings stretch, then stand.', 'No backpack', '3-second lowering'),
    c('bwo', 'hinge', 'Bridge walkout', '6–8 reps', 'From a bridge, walk your heels out a few steps and back without the hips dropping.', 'Shorter walk', 'Walk further out'),
    c('pl', 'core', 'Plank', '30–45 sec', 'Elbows under shoulders, glutes squeezed, ribs down. Quality beats time.', 'Knees down', 'Reach one arm forward'),
    c('spl', 'core', 'Side plank', '20–30 sec each side', 'Elbow under shoulder, hips high, straight from head to heels.', 'Bottom knee down', 'Top leg lifted'),
    c('dbug', 'core', 'Dead bug', '8 reps each side', 'Low back pressed into the floor. Slowly lower the opposite arm and leg, exhaling.', 'Legs only', '3 seconds each way'),
    c('bird', 'core', 'Bird dog', '8 reps each side', 'Hands and knees. Reach opposite arm and leg long, hold 2 seconds, no hip twist.', 'Arm or leg only', 'Hold 5 sec'),
    c('bear', 'core', 'Bear hold', '20–40 sec', 'Hands and toes, knees hovering an inch off the floor, back flat.', 'Shorter holds', 'Lift one hand at a time'),
    c('carry', 'core', 'Suitcase carry', '40 sec each side', 'Loaded backpack or grocery bag in one hand. Walk tall without leaning.', 'Lighter load', 'Heavier load'),
  ],
}
