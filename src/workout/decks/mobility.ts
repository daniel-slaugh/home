import type { Card, Deck, Suit } from '../types'

const c = (id: string, suit: Suit, name: string, reps: string, cue: string, easier: string, harder: string): Card => ({ id, suit, name, reps, cue, easier, harder })

// Ripples rising from the bottom of the card: range of motion, opening out.
const ripples = 'repeating-radial-gradient(circle at 50% 115%, #0000 0 9px, #f4f7e82a 9px 11px)'

export const mobility: Deck = {
  id: 'mobility',
  name: 'Mobility',
  blurb: 'Slow, controlled moves and holds that open up hips, shoulders and spine.',
  gear: 'No equipment',
  art: {
    back: {
      background: `${ripples}, radial-gradient(120% 90% at 50% 30%, #5f9447, #3a6a2c)`,
      border: '#f4f7e8',
    },
    box: { color: '#4a7d37', ink: '#2f5a22', label: '#f4f7e8' },
    lettering: { font: "Fraunces, Georgia, serif", href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,800&display=swap', scale: 0.86 },
    face: {
      background: 'radial-gradient(130% 90% at 50% 0%, #4f8a3b, #24461b)',
      text: '#f4f7e8',
      muted: '#dbe8cc',
      line: '#c9dc8f',
      accent: '#e6f29a',
    },
    suits: { red: '#ffb59a', black: '#f4f7e8', star: '#e6f29a' },
  },
  cards: [
    c('dsq', 'legs', 'Deep squat hold', '30–45 sec', 'Sink as low as you can with heels down, chest up, elbows gently pushing the knees out.', 'Hold a doorframe', 'Shift side to side slowly'),
    c('cos', 'legs', 'Cossack squat', '5 reps each side', 'Wide stance. Sit into one hip with the other leg straight, toes up. Slow down, slow up.', 'Hands on the floor', 'Pause 2 sec at the bottom'),
    c('n90', 'legs', '90/90 hip switch', '6 reps each side', 'Sit with both knees bent at 90°. Rotate both knees to the other side without using your hands.', 'Hands behind you', 'Lean over the front knee'),
    c('ank', 'legs', 'Knee-to-wall ankle rocks', '10 reps each side', 'Half kneel facing a wall. Rock the front knee forward over the toes, heel stays down.', 'Foot closer to the wall', 'Foot further back'),
    c('sts', 'legs', 'Squat to stand', '8 reps', 'Hold your toes, sink into a squat, then lift the hips and straighten the legs while holding on.', 'Hold your shins', 'Reach one arm up each rep'),
    c('lre', 'legs', 'Lunge with overhead reach', '5 reps each side', 'Step into a long lunge, back knee down, and reach both arms up and slightly back.', 'Hands on the front knee', 'Hold 3 breaths at the top'),
    c('ttn', 'push', 'Thread the needle', '6 reps each side', 'On hands and knees, slide one arm under your body, then sweep it up toward the ceiling.', 'Smaller reach', 'Pause 2 sec at each end'),
    c('wsl', 'push', 'Wall slides', '10 reps', 'Back and arms against the wall. Slide the arms up and down, keeping wrists and elbows touching.', 'Stand a step out', 'Lift off the wall at the top'),
    c('ddc', 'push', 'Down dog to cobra', '8 reps', 'From down dog, lower the hips and roll through to a cobra, then press back to down dog.', 'Knees down', 'Pause 2 sec in each shape'),
    c('scp', 'push', 'Scapular push-up', '10 reps', 'High plank, arms straight. Let the chest sink between the shoulder blades, then push it away.', 'Knees down', 'Hold the top 2 sec'),
    c('opb', 'push', 'Open book', '8 reps each side', 'Lie on your side, knees bent. Sweep the top arm over and open the chest to the floor behind you.', 'Smaller arc', 'Hold 3 breaths open'),
    c('dco', 'push', 'Doorway chest opener', '30 sec each side', 'Forearm on the doorframe at shoulder height. Step through until you feel the chest open.', 'Smaller step', 'Raise the elbow higher'),
    c('cco', 'pull', 'Cat-cow', '10 reps', 'On hands and knees, round the back up as you breathe out, then let it sag as you breathe in.', 'Smaller range', 'Move one vertebra at a time'),
    c('csr', 'pull', 'Child’s pose side reach', '30 sec each side', 'Sit back on your heels and walk both hands to one side until you feel the side of your back.', 'Knees wider', 'Press the hands into the floor'),
    c('acr', 'pull', 'Big arm circles', '10 reps each direction', 'Arms straight, draw the biggest circles you can, slowly, keeping the ribs down.', 'One arm at a time', 'Hold a water bottle'),
    c('tex', 'pull', 'Thoracic extension on the couch', '8 reps', 'Kneel with elbows on the couch, hands together. Sink the chest toward the floor, then lift.', 'Smaller range', 'Hold 3 breaths at the bottom'),
    c('qrt', 'pull', 'Quadruped rotation', '8 reps each side', 'On hands and knees, one hand behind your head. Turn the elbow down toward the other arm, then up.', 'Smaller turn', 'Sit back on your heels first'),
    c('wgs', 'hinge', 'World’s greatest stretch', '5 reps each side', 'Long lunge, both hands inside the front foot. Rotate the inside arm up, then straighten the front leg.', 'Back knee down', 'Pause 2 sec in each position'),
    c('hfl', 'hinge', 'Hip flexor lunge stretch', '30 sec each side', 'Half kneel, squeeze the back glute and tuck the hips under until the front of the hip stretches.', 'Cushion under the knee', 'Reach the same-side arm up'),
    c('pig', 'hinge', 'Pigeon stretch', '30–45 sec each side', 'Front shin across the body, back leg long. Stay tall or fold forward over the front leg.', 'Figure-four on your back', 'Fold forward onto the forearms'),
    c('hsw', 'hinge', 'Hamstring sweep', '8 reps each side', 'Heel forward, toes up, soft standing knee. Hinge and sweep both hands down along the front leg.', 'Smaller sweep', 'Hold 2 sec at the bottom'),
    c('frg', 'hinge', 'Frog stretch', '30–45 sec', 'On forearms and knees, knees wide, ankles in line with knees. Rock the hips back gently.', 'Knees closer together', 'Rock slowly back and forth'),
    c('gmo', 'hinge', 'Standing good morning', '10 reps', 'Hands on hips, soft knees. Push the hips back with a flat back until the hamstrings stretch.', 'Smaller hinge', 'Hands behind the head'),
    c('sct', 'core', 'Seated spinal twist', '30 sec each side', 'Sit tall, one knee bent over the other leg. Turn toward the bent knee, growing taller as you breathe out.', 'Both legs straight', 'Elbow outside the knee'),
    c('sup', 'core', 'Supine twist', '30 sec each side', 'On your back, knees bent together. Let them fall to one side, shoulders staying down.', 'Smaller drop', 'Straighten the top leg'),
    c('sph', 'core', 'Sphinx hold', '30–45 sec', 'Lie face down on your forearms, elbows under shoulders. Lift the chest and let the low back relax.', 'Elbows further forward', 'Straighten the arms to cobra'),
    c('wml', 'core', 'Side-lying windmill', '8 reps each side', 'On your side, knees bent. Sweep the top arm overhead and around in a big circle, eyes following the hand.', 'Half circle', 'Pause where it’s tightest'),
    c('hcr', 'core', 'Hip circles on all fours', '6 reps each direction', 'On hands and knees, draw big slow circles with your hips, keeping the arms straight.', 'Smaller circles', 'Lift one knee and circle it'),
  ],
}
