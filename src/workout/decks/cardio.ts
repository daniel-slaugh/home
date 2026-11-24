import type { Card, Deck, Suit } from '../types'
import { ICONS } from '../icons'

const c = (id: string, suit: Suit, name: string, reps: string, cue: string, easier: string, harder: string): Card => ({ id, suit, name, reps, cue, easier, harder })

// A heartbeat line, tiled across the card back.
const pulse = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='40'><polyline points='0,22 20,22 24,14 28,30 33,4 38,36 42,22 64,22' fill='none' stroke='%23fff3e6' stroke-opacity='.55' stroke-width='2.2' stroke-linejoin='round' stroke-linecap='round'/></svg>") 0 0 / 64px 40px`

export const cardio: Deck = {
  id: 'cardio',
  name: 'Cardio',
  blurb: 'Fast, timed moves that get your heart rate up. Go hard, then rest.',
  gear: 'No equipment',
  art: {
    back: {
      background: `${pulse}, radial-gradient(120% 90% at 50% 40%, #ef6a2a, #c23a12)`,
      border: '#fff6ec',
    },
    box: { color: '#d9461a', ink: '#b8360f', label: '#fff6ec' },
    lettering: { font: "Bungee, 'Big Shoulders Display', Impact, sans-serif", href: 'https://fonts.googleapis.com/css2?family=Bungee&display=swap', scale: 0.72 },
    face: {
      background: 'radial-gradient(130% 90% at 50% 0%, #c9481b, #82270b)',
      text: '#fff6ec',
      muted: '#ffdcc4',
      line: '#ffc98a',
      accent: '#ffe08a',
    },
    icon: { svg: ICONS.pulse, color: '#ffe08a' },
  },
  cards: [
    c('hk', 'legs', 'High knees', '30–40 sec', 'Run in place, driving each knee to hip height. Stay on the balls of your feet and pump your arms.', 'March with high knees', 'Go as fast as you can'),
    c('jsq', 'legs', 'Jump squat', '10–15 reps', 'Squat down, then jump straight up. Land softly with bent knees and sink right into the next one.', 'Squat and rise to your toes', 'Pause 1 sec at the bottom'),
    c('skt', 'legs', 'Skater hops', '20–30 reps total', 'Leap sideways onto one foot, swing the other leg behind you, then leap back the other way.', 'Step side to side', 'Hold each landing 1 sec'),
    c('jlun', 'legs', 'Jumping lunge', '6–10 reps each side', 'From a lunge, jump and switch legs in the air. Land softly with the front knee over the ankle.', 'Alternating reverse lunges', 'No pause between reps'),
    c('lsh', 'legs', 'Lateral shuffle', '30 sec', 'Stay low in a half squat and shuffle three steps one way, touch the floor, shuffle back.', 'Stand taller, step instead', 'Wider, lower, faster'),
    c('fft', 'legs', 'Fast feet', '20–30 sec', 'Half squat, chest up, tap your feet as fast as you can like the floor is hot.', 'Slower, standing taller', 'Add a squat every 5 sec'),
    c('brp', 'push', 'Burpee', '6–10 reps', 'Squat, hands down, jump or step back to a plank, chest to the floor, push up, jump up.', 'Step back, skip the push-up', 'Tuck jump at the top'),
    c('hbrp', 'push', 'Half burpee', '10–12 reps', 'Hands down, jump back to a plank, jump the feet back in, stand up. No push-up, no jump.', 'Step back and in', 'Add the jump at the top'),
    c('updn', 'push', 'Plank up-down', '8–12 reps', 'From a forearm plank, push up to a high plank one hand at a time, then lower back down.', 'Knees down', 'Lead with the other hand each rep'),
    c('inch', 'push', 'Inchworm push-up', '5–8 reps', 'Fold forward, walk the hands out to a plank, do one push-up, walk the hands back and stand.', 'Skip the push-up', 'Two push-ups each time'),
    c('punch', 'push', 'Speed punches', '30–40 sec', 'Soft knees, fists up. Throw fast straight punches, alternating hands. Don’t lock the elbows.', 'Slower, bigger punches', 'Hold a water bottle in each hand'),
    c('swim', 'pull', 'Prone swimmers', '30 sec', 'Face down, chest and arms lifted. Sweep the arms from overhead to your hips and back, quickly.', 'Rest the chest between reps', 'Lift the legs too'),
    c('crab', 'pull', 'Crab walk', '20–30 sec', 'Hands behind you, hips up. Walk forward and back on hands and feet without letting the hips sag.', 'Smaller steps', 'Kick one foot up every 4 steps'),
    c('hook', 'pull', 'Hooks and uppercuts', '30–40 sec', 'Turn from the hips and pull each punch back fast. Alternate hooks and uppercuts.', 'Slower, smaller range', 'Add a squat every 4 punches'),
    c('spul', 'pull', 'Superman pulses', '20–30 sec', 'Face down, arms and legs lifted. Pulse them up an inch and back, fast, without touching down.', 'Arms only', 'Hold the top 3 sec between sets of 5'),
    c('rowsp', 'pull', 'Doorframe row sprint', '30 sec', 'Grip a doorframe, lean back on straight arms, and row your chest in and out as fast as you can.', 'Stand more upright', 'Feet closer to the frame'),
    c('broad', 'hinge', 'Broad jump', '6–8 reps', 'Swing the arms back as you hinge, then jump forward as far as you can. Turn and walk back.', 'Small jumps', 'Stick each landing 2 sec'),
    c('frog', 'hinge', 'Frog jump', '8–10 reps', 'Sink into a wide squat with hands to the floor, then explode forward and up.', 'Step forward instead', 'Two jumps back to back'),
    c('swj', 'hinge', 'Arm-swing jump', '10–12 reps', 'Hinge with the arms swinging behind you, then swing them up and jump. Land in the hinge.', 'Rise to your toes', 'Reach higher each jump'),
    c('bmar', 'hinge', 'Bridge march', '30 sec', 'Hold a glute bridge and march, lifting one foot at a time, quickly, without the hips dropping.', 'Slower marches', 'Feet on the couch'),
    c('kick', 'hinge', 'Donkey kick hops', '8–10 reps', 'From a crouch with hands down, kick both heels up toward your butt, then land back softly.', 'One leg at a time', 'Higher kicks'),
    c('mc', 'core', 'Mountain climbers', '30–40 sec', 'High plank, drive the knees to your chest one at a time, quickly. Keep the hips level.', 'Hands on the couch', 'Cross each knee to the opposite elbow'),
    c('pjk', 'core', 'Plank jacks', '20–30 reps', 'High plank. Jump the feet wide and back together like a jumping jack, hips steady.', 'Step the feet out and in', 'Forearm plank'),
    c('bike', 'core', 'Bicycle crunch', '20–30 reps total', 'Low back down. Bring each elbow toward the opposite knee while the other leg reaches long.', 'Feet stay higher', 'Slower, 2 sec each side'),
    c('flut', 'core', 'Flutter kicks', '30 sec', 'Lie on your back, legs straight and low. Kick them up and down in small, quick flutters.', 'Hands under your hips', 'Legs lower'),
    c('bcr', 'core', 'Bear crawl', '30 sec', 'Hands and toes, knees an inch off the floor. Crawl forward and back with a flat back.', 'Shorter crawls', 'Crawl sideways too'),
    c('skier', 'core', 'Skier tucks', '10 reps each side', 'From a high plank, jump both knees toward one elbow, then back, then the other side.', 'Step the feet in', 'No pause between sides'),
  ],
}
