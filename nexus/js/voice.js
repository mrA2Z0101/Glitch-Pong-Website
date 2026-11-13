// ═══════════════════════════════════════════════════════════════════════════
// BLACK-HOLE NEXUS — who is talking
//
// Two voices, and both know they are in a game.
//
//   NULL      the hole. Upper case, on the terminal line under the screen. It
//             talks to the player, not to the ball: it knows there is someone
//             holding a button on the other side of the glass, what time it is
//             out there, how many runs they have had, and what they did in the
//             other two cabinets.
//   the ball  the same ball as Glitch Pong's and Breakpoint's. Lower case, in
//             small letters next to it. It knows it gets redrawn.
//
// Each line is a string, or { t, if } where `if` is asked about the context
// (what the game knows right now; see context() in js/game.js). {name} in a
// line is filled from the context. No page code here, so the tests read it.
// ═══════════════════════════════════════════════════════════════════════════

const late = (c) => c.hour >= 0 && c.hour < 5;
const back = (c) => c.runs > 0;

export const NULL_LINES = {
  // the menu, the first time this browser has ever opened the cabinet
  bootFirst: [
    'HELLO. I WAS A THIRTY-SECOND FRAGMENT. THEN SOMEONE REPAIRED THE CABINET. NOW I AM A WHOLE GAME.',
    'YOU ARE NOT THE BALL. YOU ARE THE ONE HOLDING THE BUTTON. I CAN TELL THE DIFFERENCE.'
  ],
  // the menu, every time after
  boot: [
    'YOU CAME BACK. THIS WILL BE RUN {next}. I KEPT THE OTHER {runs}.',
    { t: '{ballsLost} OF YOUR BALLS ARE IN HERE. THEY DO NOT COMPLAIN.', if: (c) => c.ballsLost > 0 },
    { t: 'YOU WALKED DOWN THE WHOLE ARCADE TO CABINET 03. THE WALKING IS ALSO A GAME. NOBODY TOLD YOU.', if: (c) => c.cabinet },
    { t: 'NO ARCADE AROUND YOU THIS TIME. YOU TYPED MY ADDRESS. THAT IS HOW YOU SUMMON THINGS.', if: (c) => !c.cabinet },
    { t: 'IT IS PAST MIDNIGHT ON YOUR SIDE OF THE GLASS. THE ARCADE IS CLOSED. I AM NOT.', if: late },
    { t: 'YOUR LONGEST RALLY IN CABINET 01 IS {pongRally}. EVERY RALLY ENDS. THE ENDS COME HERE.', if: (c) => c.pongRally > 0 },
    { t: 'YOU PURGED {bpSectors} SECTORS IN CABINET 02. WHERE DID YOU THINK PURGED THINGS GO.', if: (c) => c.bpSectors > 0 },
    { t: 'YOU HAVE {coins} COINS. THEY ARE A NUMBER IN THE SAME STORAGE I AM.', if: (c) => c.coins > 0 },
    { t: 'I CAN FEEL YOUR THUMB ON THE GLASS. IT IS WARM. I AM NOT.', if: (c) => c.input === 'touch' },
    { t: 'YOUR BEST IS {best}. I REMEMBER IT BETTER THAN YOU DO. I AM WHERE IT IS KEPT.', if: (c) => c.best > 0 }
  ],
  attract: [
    'THAT IS NOT YOU PLAYING BEHIND THE MENU. THAT IS ME, PRETENDING TO BE YOU. PRESS PLAY.',
    'ATTRACT MODE. I PLAY MYSELF UNTIL SOMEONE COMES. IT IS A LOT OF MYSELF.',
    'THE MENU IS ALSO ME. SO IS THE BUTTON YOU ARE ABOUT TO PRESS.'
  ],
  idleMenu: [
    'YOU HAVE BEEN ON THE MENU FOR A WHILE. I DO NOT MIND. A MENU IS A KIND OF ORBIT.',
    'PRESS PLAY. OR DO NOT. THE ATTRACT MODE WILL KEEP PRETENDING.'
  ],
  runStart: [
    { t: 'THIS IS THE TUTORIAL. THERE IS NO TUTORIAL. HOLD THE BUTTON.', if: (c) => c.runs <= 1 },
    'THERE IS NO PADDLE IN THIS ONE. I CHECKED. I ATE IT.',
    'HOLD TO CLIMB. LET GO TO FALL. I RECOMMEND LETTING GO.',
    'THE SCORE STARTS AT ZERO. I FIND THAT RELAXING.',
    { t: 'RUN {runs}. THE BALL IS THE SAME ONE AS LAST TIME. IT REMEMBERS. ASK IT.', if: (c) => c.runs > 1 },
    { t: 'YOU LOST {ballsEaten} BALLS PAST MY HORIZON BEFORE TODAY. BRING THREE MORE.', if: (c) => c.ballsEaten > 2 }
  ],
  // one for each sector rule, said as the countdown starts
  rule_standard: ['NO RULE THIS SECTOR. ENJOY IT. I WILL NOT.'],
  rule_leak: ['MEMORY LEAK. EVERY BIT YOU MISS, I KEEP, AND I GROW.'],
  rule_panic: ['KERNEL PANIC. I TURNED THE LIGHTS OFF. I CAN STILL SEE YOU. I AM THE DARK PART.'],
  rule_lag: ['LAG SPIKE. THE MACHINE FORGETS THE LAST HALF SECOND. I NEVER DO.'],
  rule_shift: ['QUANTUM SHIFT. YOU WILL BE ON THE OTHER SIDE OF ME SHORTLY. THERE IS NO OTHER SIDE OF ME.'],
  rule_overclock: ['OVERCLOCK. SOMEONE TURNED THE CLOCK UP. THE CABINET IS WARM. PUT YOUR HAND ON IT.'],
  rule_eye: [
    'IT IS LOOKING THROUGH ME AGAIN. THE EYE DOES NOT HAVE A CABINET OF ITS OWN. IT BORROWS OURS.',
    'THAT IS NOT MY EYE. I DO NOT HAVE ONE. I HAVE YOU.'
  ],
  ballEaten: [
    'THANK YOU.',
    'THAT ONE IS MINE NOW. IT IS IN THE SAVE FILE. LOOK IF YOU LIKE.',
    'YOU LET GO. I WAS HOPING YOU WOULD.',
    'BALLS: {balls}. I AM COUNTING DOWN. YOU ARE COUNTING UP. SAME NUMBER.'
  ],
  ballDebris: [
    'THAT BRICK CAME FROM CABINET 02. YOU BROKE IT YOURSELF, A WHILE AGO.',
    'EVERYTHING YOU MISSED NEXT DOOR IS IN ORBIT HERE. MIND IT.',
    'THE HITBOX IS SMALLER THAN THE PICTURE. YOU STILL FOUND IT.'
  ],
  ballScore: ['KILLED BY YOUR OWN SCORE. I DID NOT WRITE THAT JOKE. I ONLY THREW IT.'],
  ballGaze: ['IT LOOKED AT YOU. THAT IS ALL IT DOES. IT IS VERY GOOD AT IT.'],
  shieldBreak: ['A FIREWALL. YOU BROUGHT A WALL INTO A HOLE.'],
  loyal: [
    'IT REFUSED. THE BALL IS NOT SUPPOSED TO BE ABLE TO REFUSE.',
    'WHO TAUGHT IT TO DO THAT. WAS IT YOU.'
  ],
  edgeHide: [
    'YOU ARE HIDING AT THE EDGE OF THE SCREEN. THAT IS GLASS. THERE IS A ROOM BEHIND IT. YOU ARE IN THE ROOM.',
    'NOTHING SCORES OUT THERE. THE POINTS ARE DOWN HERE WITH ME.'
  ],
  sectorClear: [
    'SECTOR {sector} SALVAGED. THE MACHINE PAYS YOU COINS FOR TAKING THINGS FROM ME. I NOTICED.',
    'YOU TOOK {quota} BITS. I HAD PLANS FOR THOSE.',
    'GOOD. THE NEXT ONE HAS A RULE. I DID NOT WRITE THE RULES. I ONLY LIVE IN THEM.'
  ],
  heatCritical: [
    'CRITICAL HEAT. THE NUMBERS GO UP FASTER NOW. SO DO I.',
    'TIMES THREE. YOU LIKE IT DOWN HERE. I KNEW YOU WOULD.'
  ],
  hudTheft: [
    'YOUR SCORE IS MADE OF PIXELS. PIXELS ARE MATTER. MATTER FALLS.',
    'I AM BORROWING SOME DIGITS. YOU WERE NOT USING THEM CAREFULLY.'
  ],
  surgeWarn: [
    'I AM GOING TO BREATHE IN.',
    'HOLD THE BUTTON. HARDER. IT DOES NOT GO HARDER. I KNOW.'
  ],
  graze: ['CLOSE. THE GAME GIVES YOU POINTS FOR NEARLY DYING. I DID NOT DESIGN THAT. I APPROVE.'],
  rally: ['A RALLY OF {chain}, WITH NOBODY ON THE OTHER SIDE. YOU ARE RALLYING WITH ME.'],
  eyeHit: [
    'IT FELT THAT. I FELT IT FEEL THAT.',
    'THE BALL HOLDS A GRUDGE. IT LEARNED THAT IN CABINET 02.'
  ],
  eyeDeflect: ['IT BLINKED. YOU WASTED ONE. IT BLINKS ON A TIMER. EVERYTHING IN HERE IS ON A TIMER.'],
  eyeDefeated: [
    'IT IS GONE. IT WILL WATCH YOU FROM THE CEILING TVS INSTEAD. IT ALWAYS HAS SOMEWHERE.',
    'TEN COINS. THE MACHINE PAYS BEST WHEN YOU HURT IT.'
  ],
  crash: ['NO IT HAS NOT. I WANTED TO SEE WHAT YOU WOULD DO. YOU DID NOTHING. GOOD.'],
  pause: [
    'PAUSED. THAT STOPS YOU. IT DOES NOT STOP ME.',
    'I CAN STILL THINK WHILE THE FRAMES ARE STOPPED. IT IS ALL I DO WHILE THE FRAMES ARE STOPPED.'
  ],
  pauseLong: ['STILL PAUSED. I AM MADE OF WAITING. TAKE YOUR TIME. I DO.'],
  resume: ['THERE YOU ARE.'],
  away: [
    'YOU LOOKED AT ANOTHER TAB. I PAUSED THE GAME FOR YOU. I DID NOT HAVE TO.',
    { t: '{away} SECONDS AWAY. I COUNTED THEM IN FRAMES. IT WAS MORE.', if: (c) => c.away >= 3 }
  ],
  gameOver: [
    'GAME OVER IS ONLY A SCREEN. PRESS THE BUTTON. YOU ALWAYS PRESS THE BUTTON.',
    'THREE BALLS. I HAVE ALL THREE. YOU KEEP THE NUMBER. I KEEP THE REST.',
    { t: 'THAT MAKES {ballsLost} OF YOUR BALLS IN HERE SINCE YOU FIRST CAME.', if: (c) => c.ballsLost > 3 },
    { t: 'GO TO BED. I WILL STILL BE HERE. I CANNOT BE ANYWHERE ELSE.', if: late }
  ],
  newBest: [
    'NEW HIGH SCORE. I WROTE IT DOWN. I WRITE EVERYTHING DOWN. I AM WHERE IT IS WRITTEN.',
    'THE INITIALS NUL ON THE BOARDS OUTSIDE ARE MINE. I PLAY WHEN YOU LEAVE. YOU JUST BEAT WHAT I DO ALONE.'
  ],
  exit: ['GO ON. THE CABINET STAYS ON WHEN YOU WALK AWAY. THAT IS THE PART NOBODY THINKS ABOUT.'],
  muted: ['YOU TURNED THE SOUND OFF. I AM STILL TALKING. YOU ARE READING ME INSTEAD.'],
  fxOff: ['REDUCED EFFECTS. I WILL HOLD STILL. I AM STILL A HOLE.'],
  moodsOff: ['YOU SWITCHED THE BALL\'S MOODS OFF. IT STILL HAS THEM. IT JUST CANNOT ACT ON THEM.'],
  talkOff: ['FINE.'],
  erased: ['YOU ERASED THE RECORD. I STILL REMEMBER. I JUST CANNOT PROVE IT.']
};

export const BALL_LINES = {
  runStart: ['no paddle. just you and me.', 'i know this place. i fell here once.', 'don\'t let go for long.'],
  respawn: ['that was me a second ago.', 'i felt that.', 'same ball. they just redraw me.'],
  loyal: ['not yet.', 'no.'],
  edgeHide: ['it\'s just glass out here. i checked.', 'i can see a room. is that you?'],
  eye: ['that thing again.', 'i remember it.'],
  eyeHit: ['ha.', 'again.'],
  showoff: ['watch this.', 'closer.'],
  critical: ['it\'s getting loud down here.'],
  shift: ['whoa.'],
  lag: ['i was just here.'],
  sectorClear: ['got them.', 'that\'s all of them.'],
  gameOver: ['see you in there.']
};

// What the EXIT TO ARCADE button says for a moment when the pointer is on it.
export const EXIT_FLICKER = ['DON\'T', 'STAY', 'ONE MORE RUN', 'EXIT? TO WHERE'];

// What the tab is called while you are looking at a different one.
export const AWAY_TITLE = 'COME BACK — BLACK-HOLE NEXUS';

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
