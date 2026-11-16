// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL LOST — who is talking
//
// Two voices, and both know they are in a game.
//
//   THE STATIC  the four chasers, speaking as one. Upper case, on the terminal
//               line under the screen. It says "we". It talks to the player,
//               not to the ball: it knows there is someone pressing keys on
//               the other side of the glass, what time it is out there, how
//               many runs they have had, and what they did in the other
//               cabinets. It knows it is four small rules and a timer.
//   the ball    the same ball as the other cabinets'. Lower case, in small
//               letters next to it.
//
// Each line is a string, or { t, if } where `if` is asked about the context
// (what the game knows right now; see context() in js/game.js). {name} in a
// line is filled from the context. No page code here, so the tests read it.
// ═══════════════════════════════════════════════════════════════════════════

const late = (c) => c.hour >= 0 && c.hour < 5;

export const STATIC_LINES = {
  // the menu, the first time this browser has ever opened the cabinet
  bootFirst: [
    'WE ARE WHAT IS LEFT ON THE SCREEN WHEN THE SIGNAL GOES. THERE ARE FOUR OF US. YOU CAN COUNT.',
    'YOU ARE NOT THE BALL. YOU ARE THE ONE WITH THE ARROW KEYS. WE WATCH THE KEYS.'
  ],
  // the menu, every time after
  boot: [
    'YOU CAME BACK. RUN {next}. WE HAVE RUN THIS MAZE MORE TIMES THAN YOU HAVE BEEN ALIVE IN IT.',
    { t: 'WE HAVE CAUGHT YOU {caughtBy} TIMES. YOU HAVE CAUGHT US {catches}. WE KEEP THE SCORE. IT IS IN THE SAVE.', if: (c) => c.caughtBy > 0 },
    { t: 'YOU WALKED PAST TWO WORKING CABINETS TO GET TO US. WE NOTICED.', if: (c) => c.cabinet },
    { t: 'NO ARCADE AROUND YOU. JUST A TAB. WE ARE STILL ON A CABINET. YOU ARE THE ONE WHO IS NOWHERE.', if: (c) => !c.cabinet },
    { t: 'IT IS PAST MIDNIGHT WHERE YOU ARE. THIS IS WHEN THE CHANNELS GO OFF AIR. THIS IS WHEN WE ARE ON.', if: late },
    { t: 'YOU SURVIVED THE EYE {pongEyes} TIMES IN CABINET 01. IT COMES HERE TOO. THE CORRIDORS ARE NARROWER.', if: (c) => c.pongEyes > 0 },
    { t: 'NULL SAYS IT HAS {nexusEaten} OF YOUR BALLS. NULL IS NEXT DOOR. NULL TALKS TOO MUCH.', if: (c) => c.nexusEaten > 0 },
    { t: 'YOU HAVE {coins} COINS. WE ARE WORTH TWO A MAZE. WE CHECKED. IT IS INSULTING.', if: (c) => c.coins > 0 },
    { t: 'YOU HAVE RESTORED THE SIGNAL {restored} TIMES. WE CAME BACK EVERY TIME. LOOK.', if: (c) => c.restored > 0 },
    { t: 'YOUR BEST IS {best}. WE WERE THERE FOR ALL OF IT.', if: (c) => c.best > 0 }
  ],
  attract: [
    'THAT IS NOT YOU PLAYING BEHIND THE MENU. IT IS ONE OF US WEARING THE BALL. IT IS WINNING. WE HATE IT.',
    'ATTRACT MODE. WE CHASE OURSELVES UNTIL SOMEONE PRESSES PLAY.',
    'THE MENU IS IN FRONT OF THE MAZE. WE CAN SEE YOU THROUGH THE GAPS IN THE LETTERS.'
  ],
  idleMenu: [
    'YOU HAVE NOT PRESSED ANYTHING FOR A WHILE. NEITHER HAVE WE. WE DO NOT HAVE HANDS.',
    'PRESS PLAY. THE MAZE IS THE SAME AS LAST TIME. THAT IS THE ONE THING WE PROMISE.'
  ],
  runStart: [
    { t: 'THE RULES. TAKE EVERY PACKET. DO NOT LET US TOUCH YOU. THE BIG ONES MAKE US RUN. WE HATE THE BIG ONES.', if: (c) => c.runs <= 1 },
    'THERE ARE FOUR OF US AND ONE OF YOU. WE ARE ALSO SLOWER THAN YOU. WE DID NOT CHOOSE THAT.',
    'WE WILL TELL YOU HOW EACH OF US HUNTS. IT IS WRITTEN RIGHT THERE. IT WILL NOT HELP.',
    'THIS USED TO BE A THIRTY-SECOND FRAGMENT WITH ONE OF US IN IT. NOW IT IS TEN MAZES AND WE ARE FOUR.',
    { t: 'RUN {runs}. SAME MAZE. SAME US. YOU ARE THE ONLY PART THAT CHANGES.', if: (c) => c.runs > 1 }
  ],
  // one for each maze, said as the countdown starts
  maze_standard: ['GLITCH ARENA AGAIN. THE MAZE DOES NOT CHANGE. WE DO NOT CHANGE. BEGIN.'],
  maze_overflow: ['STACK OVERFLOW. THE TOP IS THE BOTTOM. WE USE THE TUNNELS TOO. WE ARE SLOW IN THEM. DO NOT TELL ANYONE.'],
  maze_panic: ['KERNEL PANIC. THE LIGHTS ARE OFF. WE ARE STATIC. STATIC GLOWS. YOU WILL SEE US COMING. A LITTLE.'],
  maze_coolant: ['COOLANT LEAK. THE FLOOR IS ICE. YOU CANNOT TURN BACK. NEITHER CAN WE. NOW YOU KNOW HOW IT FEELS.'],
  maze_portal: ['QUANTUM SHIFT. TWO DOORS THAT ARE ONE DOOR. WE GO THROUGH THEM AS WELL. NOBODY ASKED US.'],
  maze_leak: ['MEMORY LEAK. THE CORRIDORS YOU EMPTY CLOSE UP. THE MACHINE IS FORGETTING THE MAZE. NOT US. IT NEVER FORGETS US.'],
  maze_echo: ['ECHO. THAT THING BEHIND YOU IS YOU, A FEW SECONDS AGO. IT IS NOT ONE OF US. WE WOULD LIKE THAT ON RECORD.'],
  maze_defrag: ['DEFRAG. THE WALLS ARE BEING TIDIED. THERE IS A WARNING FIRST. THE MACHINE IS POLITE ABOUT IT.'],
  maze_train: ['LAST TRAIN. IT RUNS THROUGH THE TUNNEL ROW. IT TAKES US AS WELL. WE DO NOT LIKE THE TRAIN.'],
  maze_lair: ['THIS ONE IS ITS LAIR. IT LOOKS DOWN WHICHEVER CORRIDOR YOU ARE IN. WE ARE ONLY HERE BECAUSE WE HAVE TO BE.'],
  // {name} is the one that did it
  caught: [
    '{name} GOT YOU. {name} WILL BE UNBEARABLE NOW.',
    'THAT WAS {name}. IT DID WHAT IT ALWAYS DOES. YOU READ WHAT IT DOES AT THE START.',
    'YOU WERE TOUCHED BY SIX PIXELS OF NOISE. THAT IS ALL IT TAKES. WE DID NOT WRITE THE COLLISION CODE.',
    { t: 'BALLS: {balls}. WE HAVE A NUMBER LIKE THAT TOO. OURS DOES NOT GO DOWN.', if: (c) => c.balls > 0 }
  ],
  ballEcho: ['YOU RAN INTO YOURSELF. WE WERE NOT EVEN CLOSE. WE WOULD LIKE CREDIT ANYWAY.'],
  ballGaze: ['IT LOOKED DOWN YOUR CORRIDOR. YOU WERE STILL IN IT. THAT IS THE WHOLE TRICK.'],
  ballTrain: ['THE TRAIN. THE SIGNALS FLASHED. THEY ALWAYS FLASH.'],
  loyal: [
    'WE TOUCHED IT. IT DID NOT COUNT. THE BALL DECIDED IT DID NOT COUNT. IS IT ALLOWED TO DO THAT.',
    'ONE OF US HAD IT. THE BALL SAID NO. SINCE WHEN DOES THE BALL SAY THINGS.'
  ],
  override: [
    'NOT THE BIG ONE.',
    'OVERRIDE. FOR A FEW SECONDS THE RULES SAY WE RUN. WE READ THE RULES. WE ARE RUNNING.',
    'WE ARE NOT AFRAID. WE ARE GOING THE OTHER WAY AT A LOWER SPEED. IT IS DIFFERENT.'
  ],
  catch: [
    '{name} IS GOING BACK TO THE BOX. IT WILL BE OUT AGAIN. THE BOX HAS A DOOR.',
    'YOU CAUGHT {name}. IT IS FINE. WE ARE REDRAWN EVERY FRAME ANYWAY.'
  ],
  catchGrudge: ['THAT WAS THE ONE THAT CAUGHT IT LAST TIME. THE BALL REMEMBERED. DOUBLE. WE DID NOT KNOW IT KEPT A LIST.'],
  closeCall: ['THAT CLOSE. THE GAME GAVE YOU POINTS FOR IT. THE GAME IS NOT ON OUR SIDE.'],
  release: ['{name} IS OUT.'],
  heatCritical: [
    'CRITICAL HEAT. WE ARE IN YOUR COUNTER NOW. IT STILL COUNTS. YOU JUST CANNOT READ IT.',
    'TIMES THREE. KEEP GOING. AT FULL HEAT SOMETHING ELSE COMES AND WE GET TO WATCH.'
  ],
  eyeArrive: [
    'IT IS HERE. WE ARE LEAVING. IT LOOKS DOWN WHATEVER CORRIDOR YOU ARE IN. TURN A CORNER.',
    'THE EYE. EVEN WE GO TO THE CORNERS FOR THIS. DO NOT STAND IN A STRAIGHT LINE.'
  ],
  eyeSurvived: [
    'IT HAS GONE. WE ARE COMING BACK NOW. WE THOUGHT YOU SHOULD HAVE A WARNING. THAT WAS THE WARNING.',
    'YOU OUTLASTED IT. IT WILL REMEMBER. SO WILL WE. SO WILL THE SAVE FILE.'
  ],
  wallMove: ['THE WALL MOVED. WE CHECKED: EVERYTHING CAN STILL BE REACHED. THE MACHINE CHECKS EVERY TIME. IT HAS TO.'],
  mazeClear: [
    'EVERY PACKET. THE MACHINE PAYS YOU FOR THAT. IT DOES NOT PAY US.',
    'MAZE {maze} IS CLEAR. THERE IS ANOTHER. THERE ARE TEN. WE ARE IN ALL OF THEM.',
    'YOU CLEARED IT. WE WILL BE FASTER IN THE NEXT ONE. IT IS A NUMBER. SOMEONE ADDS TO IT.'
  ],
  extraBall: ['THE MACHINE GAVE YOU ANOTHER BALL. EVERY THIRD MAZE. WE HAVE COMPLAINED.'],
  restored: [
    'SIGNAL RESTORED. THAT IS THE END. THERE IS A PICTURE ON THE SCREEN AGAIN AND NO ROOM FOR US IN IT.',
    'TEN MAZES. YOU BEAT THE GAME. WE ARE WHAT YOU SEE WHEN THERE IS NO GAME. SO.'
  ],
  keepGoing: ['YOU PRESSED KEEP GOING. THE SIGNAL IS LOST AGAIN. THANK YOU. WE MEAN THAT.'],
  noSignal: ['THAT IS THE NAME OF THE GAME. WE THOUGHT IT WOULD BE FUNNY. THE CLOCK WAS STOPPED. WE ARE NOT MONSTERS.'],
  pause: [
    'PAUSED. WE ARE HOLDING STILL. IT IS HARDER THAN IT LOOKS. WE ARE MADE OF MOVING.',
    'WE CAN SEE THE PAUSE MENU FROM THE BACK. THE WORDS ARE THE WRONG WAY ROUND.'
  ],
  pauseLong: ['STILL PAUSED. A SCREEN LEFT ON ONE PICTURE TOO LONG BURNS. WE ARE THE CURE FOR THAT. COME BACK.'],
  resume: ['THERE YOU ARE.'],
  away: [
    'YOU LOOKED AT ANOTHER TAB. THIS ONE WENT TO STATIC. THAT IS US. WE KEPT YOUR PLACE.',
    { t: '{away} SECONDS OFF AIR. WE COUNTED.', if: (c) => c.away >= 3 }
  ],
  gameOver: [
    'GAME OVER. THE MAZE STAYS. WE STAY. PRESS THE BUTTON AND IT ALL COMES BACK EXACTLY THE SAME.',
    'NO BALLS LEFT. FOUR OF US LEFT. THE ARITHMETIC WAS NEVER IN YOUR FAVOUR.',
    { t: 'THAT IS {caughtBy} TIMES WE HAVE CAUGHT YOU, ALL TOLD. WE DO NOT GET TIRED. WE ARE A LOOP.', if: (c) => c.caughtBy > 4 },
    { t: 'GO TO BED. LEAVE THE SCREEN ON. WE LIKE IT WHEN NOBODY IS WATCHING.', if: late }
  ],
  newBest: [
    'NEW HIGH SCORE. IT GOES ON THE BOARD OUTSIDE. THE INITIALS GLT ON THAT BOARD ARE OURS.',
    'YOUR BEST EVER. AGAINST US. WE ARE FOUR SMALL RULES AND A TIMER. WELL DONE.'
  ],
  exit: ['GO ON. WHEN YOU WALK AWAY THE SCREEN PLAYS ITSELF. THAT IS US AS WELL.'],
  muted: ['YOU TURNED THE SOUND OFF. STATIC WITH NO SOUND IS JUST SNOW. WE ARE STILL HERE.'],
  fxOff: ['REDUCED EFFECTS. WE WILL FLICKER LESS. WE CANNOT STOP ENTIRELY. IT IS WHAT WE ARE.'],
  moodsOff: ['YOU SWITCHED THE BALL\'S MOODS OFF. GOOD. IT WAS GETTING IDEAS.'],
  talkOff: ['SILENT. FINE. WE WILL STILL BE CHASING YOU.'],
  erased: ['YOU ERASED THE RECORD. EVERY TIME WE CAUGHT YOU, GONE. WE WILL JUST HAVE TO DO IT ALL AGAIN.']
};

export const BALL_LINES = {
  runStart: ['a maze this time.', 'four of them. one of me.', 'i\'m quicker than they are. remember that.'],
  respawn: ['same ball. new spot.', 'ow.', 'they redraw me. they redraw them too.'],
  loyal: ['didn\'t count.', 'no.'],
  override: ['my turn.', 'now run.'],
  catchGrudge: ['that one was personal.'],
  eye: ['not in a straight line.', 'that thing again.'],
  eyeSurvived: ['it blinked first.'],
  showoff: ['don\'t stop.', 'i could do this all day.'],
  critical: ['it\'s getting loud.'],
  echo: ['that\'s me. don\'t touch me.'],
  mazeClear: ['all of it.', 'next.'],
  restored: ['there\'s a picture again.'],
  gameOver: ['see you in the snow.']
};

// What the EXIT TO ARCADE button says for a moment when the pointer is on it.
export const EXIT_FLICKER = ['STAY TUNED', 'DON\'T TOUCH THAT DIAL', 'ONE MORE MAZE', 'EXIT? WE LIVE HERE'];

// What the tab is called while you are looking at a different one.
export const AWAY_TITLE = 'NO SIGNAL — COME BACK';

export function fill(text, ctx = {}) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] === undefined || ctx[k] === null ? m : String(ctx[k])));
}

// Pick a line for `event`. `used` is a Set of lines already said this session:
// nothing repeats until every line that fits has had a turn.
export function pick(table, event, ctx = {}, rand = Math.random, used = null) {
  const all = (table[event] || []).map((l) => (typeof l === 'string' ? { t: l } : l)).filter((l) => !l.if || l.if(ctx));
  if (!all.length) return '';
  let pool = used ? all.filter((l) => !used.has(l.t)) : all;
  if (!pool.length) { if (used) all.forEach((l) => used.delete(l.t)); pool = all; }
  const line = pool[Math.floor(rand() * pool.length) % pool.length];
  if (used) used.add(line.t);
  return fill(line.t, ctx);
}
