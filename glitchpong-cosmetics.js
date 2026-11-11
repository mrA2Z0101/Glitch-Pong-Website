// ═══════════════════════════════════════════════════════════════════════════
// GLITCH PONG — COSMETICS v2.0
// Everything in the Store: catalog, unlock rules, equip state, renderers.
//
//   paddle skins · ball skins · ball trails · hit / score / dash / teleport
//   effects · the net · score displays · countdowns · victory effects ·
//   sound packs · titles and nameplates
//
// Everything here is visual (or audible) only. Skins never change a paddle's
// hitbox and trails never change the ball, so competitive balance is untouched.
//
// Renderers are pure canvas functions (ctx in, pixels out) so the game and the
// Store's live previews share exactly the same drawing code.
// ═══════════════════════════════════════════════════════════════════════════
const GlitchCosmetics = (function () {
  "use strict";

  const STORAGE_KEY = "glitchPong_cosmetics_v1";
  const OWNERS = ["blue", "red"];
  const SLOTS = ["paddle", "trail", "ball", "hit", "score", "dash", "teleport",
                 "net", "board", "countdown", "victory", "sound", "title", "plate"];
  const MASTERY_WINS = 25;      // wins with an item equipped to earn its gold trim
  const ID_RE = /^[a-z0-9_-]{1,40}$/i;

  const RARITY = {
    common:    { label: "COMMON",    color: "#9fd4e4" },
    rare:      { label: "RARE",      color: "#71efff" },
    epic:      { label: "EPIC",      color: "#c7a6ff" },
    legendary: { label: "LEGENDARY", color: "#ffd166" }
  };

  const ARENA_NAMES = {
    classic: "CLASSIC GRID",
    matrix: "MATRIX MAINFRAME",
    construct: "THE CONSTRUCT",
    blackhole: "BLACK-HOLE NEXUS"
  };

  // unlock.type: free | level | arenaWins | boss | stat | coins | achievement
  const item = (id, name, rarity, unlock, desc, extra) => Object.assign({ id, name, rarity, unlock, desc }, extra || {});
  const FREE = { type: "free" };
  const lvl = (level) => ({ type: "level", level });
  const arena = (a, count) => ({ type: "arenaWins", arena: a, count });
  const boss = (count) => ({ type: "boss", count });
  // `statName` is a key of the progression save, or of the extra stats the game
  // hands over through setContext() (onlineWins, coinsEarned, breakpointSectors).
  const stat = (statName, count, label) => ({ type: "stat", stat: statName, count, label });
  // Bought with Glitchcade coins, here or at PRIZETRON-80's counter.
  const coins = (cost) => ({ type: "coins", cost });
  // Comes with an achievement (see ACHIEVEMENTS in glitchpong-site.js).
  const ach = (id, label) => ({ type: "achievement", id, label });
  const SECRET = { secret: true };

  const PADDLE_SKINS = [
    item("default",      "NEON CORE",     "common",    FREE,                 "Factory-issue paddle. Clean, bright, reliable."),
    item("scanline",     "SCANLINE",      "common",    lvl(3),               "CRT scanlines roll down the paddle like an old arcade monitor."),
    item("static",       "DEAD CHANNEL",  "common",    lvl(5),               "Snowy TV static with a few stuck pixels that never change."),
    item("rgbsplit",     "RGB SPLIT",     "rare",      lvl(6),               "Colour channels tear apart. The split widens as Heat climbs."),
    item("phosphor",     "PHOSPHOR",      "rare",      arena("classic", 3),  "Green monochrome CRT with a burn-in ghost of where the paddle just was."),
    item("circuit",      "CIRCUIT BOARD", "rare",      lvl(9),               "Copper traces carry pulses of light and flare on every return."),
    item("matrixrain",   "MATRIX RAIN",   "rare",      arena("matrix", 1),   "Falling code streams through the paddle."),
    item("hexplating",   "HEX PLATING",   "rare",      arena("construct", 1),"Construct tiles that flip over in a wave from the point of contact."),
    item("cassette",     "CASSETTE",      "rare",      lvl(11),              "Two tape reels that spin with the paddle's speed."),
    item("plasma",       "PLASMA",        "epic",      lvl(13),              "A slow, liquid plasma field swirling inside the frame."),
    item("badrom",       "BAD ROM",       "epic",      lvl(15),              "Garbage sprite tiles that reshuffle on every return."),
    item("wireframe",    "WIREFRAME",     "epic",      arena("construct", 3),"A bare construct mesh with a scanning pulse and vertex nodes."),
    item("crackedscreen","CRACKED SCREEN","epic",      lvl(17),              "A new crack spreads each time you concede. It resets every match."),
    item("holofoil",     "HOLO FOIL",     "epic",      lvl(18),              "Iridescent trading-card foil that shifts colour as it moves."),
    item("brickwork",    "BRICKWORK",     "epic",      stat("breakpointSectors", 10, "PURGE 10 SECTORS IN BREAKPOINT"), "Built from Breakpoint bricks that chip a little more with every hit."),
    item("eventhorizon", "EVENT HORIZON", "legendary", arena("blackhole", 5),"A light-swallowing core circled by a glowing accretion disk."),
    item("watcher",      "THE WATCHER",   "legendary", boss(3),              "An eye taken from the Surveillance Eye. It never stops tracking the ball."),
    item("goldcore",     "GOLDEN CORE",   "legendary", lvl(25),              "Polished gold with a travelling shine. For players who stuck around."),
    item("shopkeeper",   "PRIZETRON",     "legendary", ach("prizes_all", "UNLOCK THE SOLD OUT ACHIEVEMENT"), "PRIZETRON-80's chrome chassis and LED visor. He insisted.", SECRET)
  ];

  const BALL_TRAILS = [
    item("default",      "GHOST ECHO",     "common",    FREE,                  "The classic soft afterglow. Takes your colour as the ball charges."),
    item("pixeldust",    "PIXEL DUST",     "common",    lvl(2),                "Square pixels shed off the ball and drift away."),
    item("sonar",        "SONAR RINGS",    "common",    lvl(3),                "Rings ping outward from the ball's path like a radar sweep."),
    item("ghostframes",  "GHOST FRAMES",   "common",    lvl(4),                "Stepped afterimages, like the ball is dropping frames."),
    item("oscilloscope", "OSCILLOSCOPE",   "rare",      lvl(6),                "A sine wave whose amplitude follows the ball's speed."),
    item("lightning",    "LIGHTNING",      "rare",      lvl(7),                "A crackling electric arc that redraws itself every frame."),
    item("datastream",   "DATA STREAM",    "rare",      lvl(8),                "The ball leaks a stream of binary and hex."),
    item("snake",        "SNAKE",          "rare",      lvl(9),                "Chunky segments that get longer as the rally grows."),
    item("helix",        "DOUBLE HELIX",   "rare",      lvl(10),               "Two ribbons twist around the ball's path."),
    item("comet",        "COMET",          "rare",      lvl(11),               "A smooth tapered tail that stretches with speed."),
    item("wetpaint",     "WET PAINT",      "rare",      coins(40),             "A fading stripe of paint in the colour of whoever hit last."),
    item("sparkler",     "SPARKLER",       "epic",      lvl(13),               "Hot sparks spit sideways off the trail."),
    item("glitchtear",   "GLITCH TEAR",    "epic",      lvl(15),               "Horizontal slices of the trail shear and tear apart."),
    item("taperibbon",   "TAPE RIBBON",    "epic",      lvl(17),               "Unspooling cassette tape that flutters behind the ball."),
    item("hexpath",      "HEX PATH",       "epic",      arena("construct", 5), "Floor tiles light up under the ball and fade out."),
    item("rainbow",      "RAINBOW ROAD",   "epic",      lvl(20),               "Five bands of colour that taper behind the ball."),
    item("heattrail",    "HEAT SIGNATURE", "legendary", boss(1),               "Starts in your colour, then burns orange and white-hot as Heat rises."),
    item("gravitywake",  "GRAVITY WAKE",   "legendary", arena("blackhole", 10),"The ball drags a lensed rip in space behind it.")
  ];

  const BALL_SKINS = [
    item("default",     "NEON ORB",        "common",    FREE,      "The standard glowing ball in your colour."),
    item("pixelcube",   "PIXEL CUBE",      "common",    lvl(2),    "A spinning square, straight out of the first Pong cabinet."),
    item("glitchorb",   "GLITCH ORB",      "rare",      lvl(5),    "Colour channels split around the ball and glitch on impact."),
    item("spinner",     "LOADING SPINNER", "rare",      lvl(7),    "A buffering wheel that spins faster with the ball's speed."),
    item("wireorb",     "WIREFRAME ORB",   "rare",      lvl(9),    "A rotating wireframe globe."),
    item("erroricon",   "ERROR ICON",      "rare",      lvl(10),   "A warning triangle that flashes harder as Heat climbs."),
    item("token",       "ARCADE TOKEN",    "rare",      stat("coinsEarned", 150, "EARN 150 GLITCHCADE COINS"), "A spinning arcade token with a glint on the edge."),
    item("vinyl",       "VINYL",           "epic",      lvl(12),   "A spinning record with your colour on the label."),
    item("d20",         "D20",             "epic",      lvl(14),   "Rolls a new face on every hit. The match-winning point is always a 20."),
    item("eightball",   "8-BALL",          "epic",      lvl(16),   "Outlook not so good — for your opponent."),
    item("discoball",   "DISCO BALL",      "epic",      coins(60), "Mirror tiles that throw flecks of light around the ball."),
    item("minieye",     "MINI EYE",        "legendary", boss(2),   "A tiny Surveillance Eye that looks where it is going."),
    item("singularity", "SINGULARITY",     "legendary", arena("blackhole", 3), "A tiny black hole with a lensing ring. Pairs with Gravity Wake.")
  ];

  const HIT_EFFECTS = [
    item("default",      "STANDARD",      "common",    FREE,      "The arena's built-in camera kick. No extra effect."),
    item("shockring",    "SHOCK RING",    "common",    lvl(2),    "Twin rings blast out from the point of contact."),
    item("shards",       "SHARDS",        "rare",      lvl(4),    "The ball shatters a burst of glass shards off the paddle."),
    item("pixelpop",     "PIXEL POP",     "rare",      lvl(7),    "Chunky pixels pop off and fall with gravity."),
    item("rallycounter", "RALLY COUNTER", "rare",      lvl(9),    "The rally count pops off the paddle, bigger with every hit."),
    item("coinspray",    "COIN SPRAY",    "rare",      coins(35), "A few arcade tokens scatter and bounce."),
    item("equalizer",    "EQUALIZER",     "epic",      lvl(12),   "Audio bars jump out of the point of contact."),
    item("glyphs",       "GLYPH BURST",   "epic",      stat("longestRally", 20, "LAND A 20-HIT RALLY"), "Code glyphs scatter from every return."),
    item("arcflash",     "ARC FLASH",     "legendary", lvl(14),   "Lightning forks out of the paddle with a white flash.")
  ];

  const SCORE_EFFECTS = [
    item("default",     "STANDARD",        "common",    FREE,      "The arena's built-in score shake. No extra effect."),
    item("shockwave",   "SHOCKWAVE",       "common",    lvl(3),    "A huge ring rolls out of the goal you scored in."),
    item("pixelburst",  "PIXEL EXPLOSION", "rare",      lvl(6),    "The goal mouth explodes into pixels."),
    item("binaryspill", "BINARY SPILL",    "rare",      lvl(12),   "Ones and zeros pour out of the breach."),
    item("fireworks",   "FIREWORKS",       "epic",      stat("wins", 10, "WIN 10 MATCHES"), "Rockets launch from the goal and burst overhead."),
    item("jackpot",     "JACKPOT",         "epic",      coins(75), "The goal pays out like a slot machine."),
    item("fatalerror",  "FATAL ERROR",     "epic",      lvl(22),   "A half-second crash screen over the loser's half."),
    item("signalloss",  "SIGNAL LOSS",     "legendary", lvl(18),   "The picture tears and rolls like a dying broadcast."),
    item("eyeopens",    "THE EYE OPENS",   "legendary", boss(4),   "A giant eye opens in the goal mouth and blinks."),
    item("collapse",    "COLLAPSE",        "legendary", arena("blackhole", 7), "The goal implodes and drags everything nearby in.")
  ];

  const DASH_EFFECTS = [
    item("default",      "AFTERIMAGE",     "common",    FREE,     "The standard glowing afterimages."),
    item("smear",        "MOTION SMEAR",   "common",    lvl(3),   "A long gradient smear where the paddle just was."),
    item("lightwall",    "LIGHT WALL",     "rare",      lvl(6),   "A solid ribbon of light that fades behind the dash."),
    item("speedlines",   "SPEED LINES",    "rare",      lvl(8),   "Anime speed lines streak behind the dash."),
    item("rubberband",   "RUBBER BAND",    "rare",      lvl(11),  "The paddle stretches out, then snaps to its new spot."),
    item("ghostclones",  "GHOST CLONES",   "rare",      stat("dashUses", 50, "DASH 50 TIMES"), "Chromatic outline clones hang in the air."),
    item("pixelscatter", "PIXEL SCATTER",  "epic",      stat("dashUses", 150, "DASH 150 TIMES"), "The old position dissolves into drifting pixels."),
    item("frameskip",    "FRAME SKIP",     "epic",      stat("dashUses", 300, "DASH 300 TIMES"), "Three hard-cut positions and no blur at all."),
    item("afterburn",    "AFTERBURN",      "legendary", lvl(16),  "Thrusters fire. The dash leaves a burning exhaust plume.")
  ];

  // The ball's glitch teleport, in the style of whoever last hit it.
  const TELEPORT_EFFECTS = [
    item("default",     "STANDARD",          "common",    FREE,    "The ball blinks out with no extra effect."),
    item("pixelate",    "PIXELATE",          "common",    lvl(4),  "The ball breaks into a grid of pixels and reassembles."),
    item("notfound",    "404",               "rare",      lvl(5),  "Leaves BALL NOT FOUND where the ball vanished."),
    item("staticburst", "STATIC BURST",      "rare",      lvl(7),  "A cloud of TV static where it left and where it lands."),
    item("portal",      "PORTAL",            "rare",      lvl(10), "Spinning portals open at both ends of the jump."),
    item("rewind",      "REWIND",            "epic",      lvl(12), "VHS tracking bars and a quick scrub back along the jump."),
    item("beam",        "TRANSPORTER BEAM",  "epic",      lvl(14), "A column of light beams the ball across the arena."),
    item("wormhole",    "WORMHOLE",          "legendary", arena("blackhole", 2), "A lensed tunnel joins the two ends of the jump."),
    item("datashred",   "DATA SHRED",        "legendary", boss(5), "The ball is shredded into packets that stream to the new spot.")
  ];

  // The centre line. One net for the whole court, so both sides share it.
  const NET_STYLES = [
    item("default",  "ARENA DEFAULT",  "common", FREE,               "Whatever centre line the arena comes with."),
    item("tape",     "DASHED TAPE",    "common", lvl(4),             "Fat white dashes, straight off the first Pong cabinet."),
    item("laser",    "LASER",          "rare",   lvl(8),             "A hot beam split in both players' colours. It flares with Heat."),
    item("marquee",  "MARQUEE LIGHTS", "rare",   coins(45),          "A row of chasing theatre bulbs down the middle of the court."),
    item("waveform", "WAVEFORM",       "epic",   lvl(13),            "A live audio waveform that gets louder as Heat climbs."),
    item("codefall", "FALLING CODE",   "epic",   arena("matrix", 4), "A single column of code rains down the centre line.")
  ];

  // Big score digits behind the play. The HUD line stays where it is.
  const SCORE_DISPLAYS = [
    item("default",   "HUD ONLY",      "common", FREE,      "Your score stays in the HUD line and nowhere else."),
    item("sevenseg",  "SEVEN SEGMENT", "common", lvl(5),    "Glowing calculator digits floating over your half."),
    item("dotmatrix", "DOT MATRIX",    "rare",   lvl(10),   "A stadium scoreboard built from round bulbs."),
    item("flipclock", "FLIP CLOCK",    "epic",   coins(55), "A split-flap card that flips over when you score."),
    item("nixie",     "NIXIE TUBES",   "epic",   lvl(16),   "A warm glowing numeral inside a glass tube.")
  ];

  // The 3-2-1-GO before each serve. Shared by both sides.
  const COUNTDOWN_STYLES = [
    item("default",    "CLASSIC ART",  "common", FREE,      "The original hand-drawn 3, 2, 1, GO."),
    item("segment",    "LAUNCH CLOCK", "common", lvl(4),    "A mission-control clock counting down in seven-segment digits."),
    item("terminal",   "TERMINAL",     "rare",   lvl(11),   "The countdown is typed at a command prompt, then executed."),
    item("insertcoin", "INSERT COIN",  "rare",   coins(40), "Three tokens, two tokens, one token, GO."),
    item("glitchtype", "GLITCH TYPE",  "epic",   lvl(19),   "Huge block numerals with the colour channels pulled apart.")
  ];

  // Plays over the match-winning point, for whoever won it.
  const VICTORY_EFFECTS = [
    item("default",   "STANDARD",        "common",    FREE,   "The built-in FINAL POINT camera. No extra effect."),
    item("confetti",  "TICKER TAPE",     "common",    stat("wins", 3, "WIN 3 MATCHES"), "Confetti in both colours pours down the whole court."),
    item("override",  "SYSTEM OVERRIDE", "rare",      lvl(15), "Your colour wipes across the screen in scan bars and stamps it."),
    item("supernova", "SUPERNOVA",       "epic",      stat("wins", 25, "WIN 25 MATCHES"), "Your paddle goes off like a star, with rays to every corner."),
    item("crown",     "CROWN",           "legendary", stat("bestWinStreak", 5, "WIN 5 MATCHES IN A ROW"), "A pixel crown drops out of the sky and lands on your paddle.")
  ];

  // Replaces the paddle-hit and score sounds for that side.
  const SOUND_PACKS = [
    item("default",    "STANDARD",   "common", FREE,      "The original recorded hit and score sounds."),
    item("chiptune",   "CHIPTUNE",   "common", lvl(4),    "Square-wave blips that climb in pitch as the ball charges."),
    item("sonar",      "SONAR",      "rare",   lvl(9),    "A submarine ping on every hit and a long sweep on a score."),
    item("typewriter", "TYPEWRITER", "rare",   coins(35), "A key clack on every hit and the carriage bell on a score."),
    item("drumkit",    "DRUM KIT",   "epic",   lvl(14),   "Kick and snare trade hits. Scoring crashes the cymbal.")
  ];

  // Shown under your name on the match intro card and in online lobbies.
  const TITLES = [
    item("default",       "NO TITLE",       "common",    FREE,    "Just your name."),
    item("runner",        "GLITCH RUNNER",  "common",    lvl(7),  "For players who have found their feet."),
    item("rallyking",     "RALLY KING",     "rare",      stat("longestRally", 30, "LAND A 30-HIT RALLY"), "For players who refuse to let the ball die."),
    item("netrunner",     "NETRUNNER",      "rare",      stat("onlineWins", 1, "WIN AN ONLINE MATCH"), "For winning a match against another human over the wire."),
    item("brickbreaker",  "BRICK BREAKER",  "rare",      stat("breakpointSectors", 25, "PURGE 25 SECTORS IN BREAKPOINT"), "For players who moonlight at the Breakpoint cabinet."),
    item("breach",        "SYSTEM BREACH",  "rare",      lvl(20), "For players the system has started to notice."),
    item("eyewitness",    "EYE WITNESS",    "epic",      boss(2), "For players who looked back at the Eye."),
    item("highroller",    "HIGH ROLLER",    "epic",      coins(90), "For players with coins to burn."),
    item("lanlegend",     "LAN LEGEND",     "epic",      stat("onlineWins", 10, "WIN 10 ONLINE MATCHES"), "For players with a winning record against humans."),
    item("lord",          "GLITCH LORD",    "legendary", lvl(40), "The top of the level ladder."),
    item("fashionvictim", "FASHION VICTIM", "legendary", ach("full_set", "UNLOCK THE MATCHING OUTFIT ACHIEVEMENT"), "For winning in a complete matching set.", SECRET)
  ];

  // The frame around your name on the intro card and in online lobbies.
  const NAMEPLATES = [
    item("default",   "PLAIN TAG",   "common",    FREE,   "Your name in your colour. No frame."),
    item("neon",      "NEON TUBE",   "common",    lvl(5), "A glowing tube outline that flickers now and then."),
    item("hazard",    "HAZARD TAPE", "rare",      lvl(12), "Black and yellow warning stripes along both edges."),
    item("holo",      "HOLO BADGE",  "epic",      stat("onlineWins", 3, "WIN 3 ONLINE MATCHES"), "An iridescent badge with a sweeping shine."),
    item("gold",      "GOLD PLATE",  "legendary", coins(120), "An engraved gold plate with riveted corners."),
    item("allseeing", "ALL-SEEING",  "legendary", ach("boss_10", "UNLOCK THE STARING CONTEST ACHIEVEMENT"), "A plate with the Eye set into it. It blinks.", SECRET)
  ];

  const CATALOG = {
    paddle: PADDLE_SKINS, trail: BALL_TRAILS, ball: BALL_SKINS,
    hit: HIT_EFFECTS, score: SCORE_EFFECTS, dash: DASH_EFFECTS, teleport: TELEPORT_EFFECTS,
    net: NET_STYLES, board: SCORE_DISPLAYS, countdown: COUNTDOWN_STYLES, victory: VICTORY_EFFECTS,
    sound: SOUND_PACKS, title: TITLES, plate: NAMEPLATES
  };
  // shared:  one item for the whole court, so equipping sets it for both sides.
  // mastery: false for slots with nothing to put a gold trim on.
  // shuffle: false keeps the slot out of Shuffle Loadout.
  const SLOT_INFO = {
    paddle:    { label: "PADDLE SKINS",   noun: "SKIN" },
    trail:     { label: "BALL TRAILS",    noun: "TRAIL" },
    ball:      { label: "BALL SKINS",     noun: "BALL" },
    hit:       { label: "HIT EFFECTS",    noun: "HIT EFFECT" },
    score:     { label: "SCORE EFFECTS",  noun: "SCORE EFFECT" },
    dash:      { label: "DASH EFFECTS",   noun: "DASH" },
    teleport:  { label: "TELEPORTS",      noun: "TELEPORT" },
    net:       { label: "NET",            noun: "NET", shared: true },
    board:     { label: "SCORE DISPLAYS", noun: "SCORE DISPLAY" },
    countdown: { label: "COUNTDOWNS",     noun: "COUNTDOWN", shared: true, mastery: false },
    victory:   { label: "VICTORY",        noun: "VICTORY EFFECT" },
    sound:     { label: "SOUND PACKS",    noun: "SOUND PACK", mastery: false },
    title:     { label: "TITLES",         noun: "TITLE", mastery: false, shuffle: false },
    plate:     { label: "NAMEPLATES",     noun: "NAMEPLATE", mastery: false, shuffle: false }
  };
  SLOTS.forEach(slot => CATALOG[slot].forEach(it => { it.slot = slot; }));

  // Matching sets. Equip every piece on one side and that side gets the bonus.
  const SETS = [
    { id: "eye", name: "THE EYE SET",
      pieces: { paddle: "watcher", ball: "minieye", trail: "heattrail", teleport: "datashred" },
      bonus: "A giant eye opens behind your paddle and follows the ball." },
    { id: "void", name: "EVENT HORIZON SET",
      pieces: { paddle: "eventhorizon", ball: "singularity", trail: "gravitywake", score: "collapse" },
      bonus: "Stars spiral slowly into your side of the court." },
    { id: "arcade", name: "HIGH SCORE SET",
      pieces: { ball: "token", hit: "coinspray", score: "jackpot" },
      bonus: "Marquee bulbs chase along your goal line." },
    { id: "tape", name: "MIXTAPE SET",
      pieces: { paddle: "cassette", ball: "vinyl", trail: "taperibbon", teleport: "rewind" },
      bonus: "A VHS PLAY stamp and a tracking line roll over your half." }
  ];

  const STAT_LABELS = { wins: "WINS", dashUses: "DASHES", longestRally: "HIT RALLY", matchesPlayed: "MATCHES" };

  // ─── Things the module can't see for itself ───────────────────────────────
  // The game hands over a function returning
  //   { stats: { onlineWins, coinsEarned, ... }, achievements: { id: true }, coins }
  // It is read at most twice a second: unlock checks run every frame and the
  // wallet lives in localStorage.
  let contextFn = null;
  let contextCache = null;
  let contextAt = 0;
  function setContext(fn) { contextFn = typeof fn === "function" ? fn : null; contextCache = null; }
  function refreshContext() { contextCache = null; }
  function context() {
    const now = Date.now();
    if (contextCache && now - contextAt < 500) return contextCache;
    let c = null;
    try { c = contextFn ? contextFn() : null; } catch (e) { c = null; }
    contextCache = {
      stats: (c && c.stats) || {},
      achievements: (c && c.achievements) || {},
      coins: Math.max(0, Number(c && c.coins) || 0)
    };
    contextAt = now;
    return contextCache;
  }

  // ─── Unlock rules ─────────────────────────────────────────────────────────
  function progressFor(item, data) {
    const u = item.unlock || { type: "free" };
    const d = data || {};
    if (u.type === "level") {
      const cur = Math.max(1, Number(d.level) || 1);
      return { unlocked: cur >= u.level, current: Math.min(cur, u.level), target: u.level,
               label: `REACH LEVEL ${u.level}` };
    }
    if (u.type === "arenaWins") {
      const wins = Number(d.arenaStats && d.arenaStats[u.arena] && d.arenaStats[u.arena].wins) || 0;
      const plural = u.count === 1 ? "MATCH" : `${u.count} MATCHES`;
      return { unlocked: wins >= u.count, current: Math.min(wins, u.count), target: u.count,
               label: `WIN ${plural} IN ${ARENA_NAMES[u.arena] || u.arena.toUpperCase()}` };
    }
    if (u.type === "boss") {
      const n = Number(d.bossSurvivals) || 0;
      return { unlocked: n >= u.count, current: Math.min(n, u.count), target: u.count,
               label: u.count === 1 ? "SURVIVE THE SURVEILLANCE EYE" : `SURVIVE THE EYE ${u.count} TIMES` };
    }
    if (u.type === "stat") {
      const n = Number(d[u.stat]) || Number(context().stats[u.stat]) || 0;
      return { unlocked: n >= u.count, current: Math.min(n, u.count), target: u.count,
               label: u.label || `${u.count} ${STAT_LABELS[u.stat] || u.stat.toUpperCase()}` };
    }
    if (u.type === "coins") {
      const owned = state.owned.includes(key(item.slot, item.id));
      return { unlocked: owned, current: owned ? u.cost : Math.min(u.cost, context().coins), target: u.cost,
               label: `BUY FOR ${u.cost} COINS`, cost: u.cost };
    }
    if (u.type === "achievement") {
      const got = !!context().achievements[u.id];
      return { unlocked: got, current: got ? 1 : 0, target: 1, label: u.label || "UNLOCK AN ACHIEVEMENT" };
    }
    return { unlocked: true, current: 1, target: 1, label: "UNLOCKED BY DEFAULT" };
  }

  function find(slot, id) {
    return (CATALOG[slot] || []).find(item => item.id === id) || null;
  }

  function isUnlocked(slot, id, data) {
    const item = find(slot, id);
    return !!item && progressFor(item, data).unlocked;
  }

  // Save keys look like "paddle-scanline" (letters, digits and dashes only, so
  // they survive the save export/import filter).
  function key(slot, id) { return `${slot}-${id}`; }

  // Records every unlocked item in the progression save and returns the ones
  // that were not recorded before, so the caller can announce them.
  function syncUnlocks(data) {
    if (!data) return [];
    if (!Array.isArray(data.cosmeticsUnlocked)) data.cosmeticsUnlocked = ["default"];
    const fresh = [];
    SLOTS.forEach(slot => {
      CATALOG[slot].forEach(item => {
        const k = key(slot, item.id);
        if (progressFor(item, data).unlocked && !data.cosmeticsUnlocked.includes(k)) {
          data.cosmeticsUnlocked.push(k);
          if (item.unlock.type !== "free") fresh.push({ slot, item });
        }
      });
    });
    return fresh;
  }

  // ─── Saved state (per browser) ────────────────────────────────────────────
  //   equipped  what each paddle side wears, per slot
  //   seen      unlocked items whose NEW badge has been shown
  //   owned     items bought with coins
  //   mastery   wins with each item equipped ("paddle-scanline": 12)
  //   plain     mastered items whose gold trim has been switched off
  //   shuffle   sides that get a random loadout every match
  function defaultState() {
    return {
      equipped: {
        blue: Object.fromEntries(SLOTS.map(slot => [slot, "default"])),
        red:  Object.fromEntries(SLOTS.map(slot => [slot, "default"]))
      },
      seen: [],
      owned: [],
      mastery: {},
      plain: [],
      shuffle: { blue: false, red: false }
    };
  }

  let state = defaultState();
  let rolled = null;            // this match's Shuffle Loadout picks, never saved

  // Rebuilds a saved record from anything (an old save, an imported file,
  // garbage), keeping only well-formed values. Also used by the save importer.
  function sanitize(parsed) {
    const next = defaultState();
    if (!parsed || typeof parsed !== "object") return next;
    const keys = (list) => (Array.isArray(list)
      ? [...new Set(list.filter(k => typeof k === "string" && ID_RE.test(k)))].slice(0, 400) : []);
    OWNERS.forEach(owner => {
      SLOTS.forEach(slot => {
        const id = parsed.equipped && parsed.equipped[owner] && parsed.equipped[owner][slot];
        if (typeof id === "string" && find(slot, id)) next.equipped[owner][slot] = id;
      });
    });
    // A shared slot has one item for both sides; the left side's wins a tie.
    SLOTS.filter(slot => SLOT_INFO[slot].shared).forEach(slot => { next.equipped.red[slot] = next.equipped.blue[slot]; });
    next.seen = keys(parsed.seen);
    const known = (k) => { const i = k.indexOf("-"); return i > 0 && !!find(k.slice(0, i), k.slice(i + 1)); };
    next.owned = keys(parsed.owned).filter(known);
    next.plain = keys(parsed.plain).filter(known);
    if (parsed.mastery && typeof parsed.mastery === "object") {
      Object.keys(parsed.mastery).slice(0, 400).forEach(k => {
        const n = Math.floor(Number(parsed.mastery[k]));
        if (ID_RE.test(k) && known(k) && n > 0) next.mastery[k] = Math.min(MASTERY_WINS, n);
      });
    }
    OWNERS.forEach(owner => { next.shuffle[owner] = !!(parsed.shuffle && parsed.shuffle[owner]); });
    return next;
  }

  function load() {
    rolled = null;
    try { state = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); }
    catch (e) { state = defaultState(); }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // What the Store shows as equipped. A locked item can still be in the save
  // (e.g. after a progression reset), so the default is used until it is
  // earned again.
  function getSaved(owner, slot, data) {
    const id = state.equipped[owner] && state.equipped[owner][slot];
    if (!id || id === "default") return "default";
    if (data && !isUnlocked(slot, id, data)) return "default";
    return find(slot, id) ? id : "default";
  }

  // What the game draws: this match's shuffle pick when Shuffle Loadout is on
  // for that side, otherwise the saved item.
  function getEquipped(owner, slot, data) {
    const side = SLOT_INFO[slot] && SLOT_INFO[slot].shared ? "blue" : owner;
    if (rolled && state.shuffle[side] && rolled[side] && rolled[side][slot]) {
      const id = rolled[side][slot];
      if (!data || isUnlocked(slot, id, data)) return id;
    }
    return getSaved(owner, slot, data);
  }

  function equip(owner, slot, id, data) {
    if (!OWNERS.includes(owner) || !find(slot, id)) return false;
    if (data && !isUnlocked(slot, id, data)) return false;
    (SLOT_INFO[slot].shared ? OWNERS : [owner]).forEach(o => { state.equipped[o][slot] = id; });
    save();
    return true;
  }

  function isNew(slot, id, data) {
    const item = find(slot, id);
    if (!item || item.unlock.type === "free") return false;
    return progressFor(item, data).unlocked && !state.seen.includes(key(slot, id));
  }

  function markSeen(slot, data) {
    let changed = false;
    CATALOG[slot].forEach(item => {
      const k = key(slot, item.id);
      if (progressFor(item, data).unlocked && !state.seen.includes(k)) {
        state.seen.push(k);
        changed = true;
      }
    });
    if (changed) save();
  }

  function countNew(data) {
    let n = 0;
    SLOTS.forEach(slot => CATALOG[slot].forEach(item => { if (isNew(slot, item.id, data)) n++; }));
    return n;
  }

  // ─── Coins ────────────────────────────────────────────────────────────────
  // Every coin-priced item, cheapest first, for PRIZETRON's catalog.
  function coinItems() {
    const out = [];
    SLOTS.forEach(slot => CATALOG[slot].forEach(it => {
      if (it.unlock.type === "coins") out.push({ slot, item: it, cost: it.unlock.cost, owned: state.owned.includes(key(slot, it.id)) });
    }));
    return out.sort((a, b) => a.cost - b.cost);
  }

  // `wallet` is anything with spend(n) that returns a falsy value when the
  // coins aren't there (GlitchcadeWallet). Returns "ok", "owned", "poor" or
  // "invalid". A bought item is recorded in `data` so it isn't announced again.
  function buy(slot, id, wallet, data) {
    const it = find(slot, id);
    if (!it || it.unlock.type !== "coins") return "invalid";
    const k = key(slot, id);
    if (state.owned.includes(k)) return "owned";
    if (!wallet || typeof wallet.spend !== "function" || !wallet.spend(it.unlock.cost)) return "poor";
    state.owned.push(k);
    save();
    refreshContext();
    if (data) {
      if (!Array.isArray(data.cosmeticsUnlocked)) data.cosmeticsUnlocked = ["default"];
      if (!data.cosmeticsUnlocked.includes(k)) data.cosmeticsUnlocked.push(k);
    }
    return "ok";
  }

  // ─── Mastery: a gold trim for 25 wins with an item equipped ───────────────
  const canMaster = (slot, id) => id !== "default" && !!find(slot, id) && SLOT_INFO[slot].mastery !== false;

  function masteryFor(slot, id) {
    const wins = canMaster(slot, id) ? Math.min(MASTERY_WINS, state.mastery[key(slot, id)] || 0) : 0;
    return { wins, target: MASTERY_WINS, mastered: wins >= MASTERY_WINS, trim: wins >= MASTERY_WINS && !state.plain.includes(key(slot, id)) };
  }

  // Whether to draw the gold trim on what this side is wearing in `slot`.
  function isGilded(owner, slot, data) {
    const id = getEquipped(owner, slot, data);
    return id !== "default" && masteryFor(slot, id).trim;
  }

  function setTrim(slot, id, on) {
    const k = key(slot, id);
    const i = state.plain.indexOf(k);
    if (on && i >= 0) state.plain.splice(i, 1);
    if (!on && i < 0 && find(slot, id)) state.plain.push(k);
    save();
  }

  // Call once when `owner` wins a match that counts. Returns the items that
  // just reached mastery, for the match summary.
  function recordWin(owner, data) {
    if (!OWNERS.includes(owner)) return [];
    const fresh = [];
    SLOTS.forEach(slot => {
      const id = getEquipped(owner, slot, data);
      if (!canMaster(slot, id)) return;
      const k = key(slot, id);
      const before = state.mastery[k] || 0;
      if (before >= MASTERY_WINS) return;
      state.mastery[k] = before + 1;
      if (before + 1 >= MASTERY_WINS) fresh.push({ slot, item: find(slot, id) });
    });
    save();
    return fresh;
  }

  function masteredCount() {
    return Object.keys(state.mastery).filter(k => state.mastery[k] >= MASTERY_WINS).length;
  }

  // ─── Sets ─────────────────────────────────────────────────────────────────
  // The set this side is wearing in full, or null.
  function activeSet(owner, data) {
    return SETS.find(set => Object.keys(set.pieces).every(slot => getEquipped(owner, slot, data) === set.pieces[slot])) || null;
  }

  // For the Store: each set with how many pieces are unlocked and worn.
  function setStatus(owner, data) {
    return SETS.map(set => {
      const pieces = Object.keys(set.pieces).map(slot => {
        const it = find(slot, set.pieces[slot]);
        return { slot, item: it, unlocked: progressFor(it, data).unlocked, equipped: getSaved(owner, slot, data) === it.id };
      });
      return { set, pieces, ready: pieces.every(p => p.unlocked), active: pieces.every(p => p.equipped) };
    });
  }

  function equipSet(owner, setId, data) {
    const set = SETS.find(s => s.id === setId);
    if (!set || !Object.keys(set.pieces).every(slot => isUnlocked(slot, set.pieces[slot], data))) return false;
    Object.keys(set.pieces).forEach(slot => equip(owner, slot, set.pieces[slot], data));
    return true;
  }

  // ─── Shuffle Loadout ──────────────────────────────────────────────────────
  function getShuffle(owner) { return !!state.shuffle[owner]; }
  function setShuffle(owner, on) {
    if (!OWNERS.includes(owner)) return;
    state.shuffle[owner] = !!on;
    if (!on && rolled) rolled[owner] = null;
    save();
  }

  // Call at the start of every match: each side with Shuffle Loadout on gets a
  // random unlocked item in every slot. `rand` is injectable for tests.
  function rollShuffle(data, rand) {
    const rnd = typeof rand === "function" ? rand : Math.random;
    rolled = { blue: null, red: null };
    OWNERS.forEach(owner => {
      if (!state.shuffle[owner]) return;
      const picks = {};
      SLOTS.forEach(slot => {
        if (SLOT_INFO[slot].shuffle === false) return;
        const pool = CATALOG[slot].filter(it => progressFor(it, data).unlocked);
        picks[slot] = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))].id;
      });
      rolled[owner] = picks;
    });
    return rolled;
  }

  // ─── Player card: what an online opponent is told about you ───────────────
  // Only item ids cross the wire. The other end looks them up in its own
  // catalog, so nothing a stranger sends is ever shown as text.
  function card(owner, data) {
    return { title: getEquipped(owner, "title", data), plate: getEquipped(owner, "plate", data) };
  }
  function cleanCard(c) {
    const pick = (slot) => (c && typeof c === "object" && typeof c[slot] === "string" && find(slot, c[slot]) ? c[slot] : "default");
    return { title: pick("title"), plate: pick("plate") };
  }
  function titleText(id) {
    const it = id && id !== "default" ? find("title", id) : null;
    return it ? it.name : "";
  }

  // ─── Colour + noise helpers ───────────────────────────────────────────────
  function rgba(rgb, a) { return `rgba(${rgb},${Math.max(0, Math.min(1, a))})`; }

  function parseRgb(rgb) { return String(rgb).split(",").map(v => Number(v) || 0); }

  function mixRgb(a, b, k) {
    const pa = parseRgb(a), pb = parseRgb(b);
    return pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(",");
  }

  // Cheap deterministic noise in [0, 1).
  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  // Interpolates extra samples between trail points. f = 1 at the ball, 0 at the tail.
  function densify(trail, sub) {
    const out = [];
    const n = trail.length;
    if (n === 0) return out;
    const total = Math.max(1, (n - 1) * sub);
    for (let i = 0; i < n - 1; i++) {
      const a = trail[i], b = trail[i + 1];
      for (let s = 0; s < sub; s++) {
        const k = s / sub;
        const idx = i * sub + s;
        out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, f: 1 - idx / total });
      }
    }
    out.push({ x: trail[n - 1].x, y: trail[n - 1].y, f: 0 });
    return out;
  }

  // Evenly spaced samples along the trail (by distance), newest first.
  function resample(trail, spacing) {
    const out = [];
    if (trail.length === 0) return out;
    let total = 0;
    for (let i = 1; i < trail.length; i++) total += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
    if (total <= 0) return out;
    let walked = 0;
    let next = spacing;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      while (seg > 0 && next <= walked + seg) {
        const k = (next - walked) / seg;
        out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, f: 1 - next / total, d: next });
        next += spacing;
      }
      walked += seg;
    }
    return out;
  }

  function strokeFrame(ctx, x, y, w, h, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  // ─── Paddle skins ─────────────────────────────────────────────────────────
  // o = { rgb, hex, t (seconds), heat (0-1), pulse, quality (0-1), img, imgReady }

  function paddleDefault(ctx, x, y, w, h, o) {
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 1);
    ctx.shadowBlur = 30 + Math.max(0, (o.pulse || 0) * 0.35);
    ctx.fillStyle = o.hex;
    ctx.fillRect(x, y, w, h);
    if (o.imgReady && o.img) {
      // Preserve the paddle texture while tinting it to the selected colour.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.globalAlpha = 0.24;
      ctx.drawImage(o.img, x, y, w, h);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.56;
      ctx.fillStyle = o.hex;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
    ctx.strokeStyle = rgba(o.rgb, 1);
    ctx.globalAlpha = 0.82;
    ctx.lineWidth = 1.75;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  function paddleScanline(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.45);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.95);
    ctx.shadowBlur = (26 + Math.max(0, (o.pulse || 0) * 0.3)) * (o.quality < 0.55 ? 0.6 : 1);
    ctx.fillStyle = rgba(mixRgb(o.rgb, "0,0,0", 0.62), 1);
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    const body = ctx.createLinearGradient(x, 0, x + w, 0);
    body.addColorStop(0, rgba(o.rgb, 0.6));
    body.addColorStop(0.5, rgba(light, 1));
    body.addColorStop(1, rgba(o.rgb, 0.6));
    ctx.fillStyle = body;
    const spacing = 4;
    const offset = (o.t * 22) % spacing;
    for (let yy = y - spacing + offset; yy < y + h; yy += spacing) ctx.fillRect(x, yy, w, 2);

    // A brighter refresh band rolls down the paddle.
    const span = h + 60;
    const bandY = y - 30 + ((o.t * 0.55) % 1) * span;
    const band = ctx.createLinearGradient(0, bandY - 22, 0, bandY + 22);
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.5, "rgba(255,255,255,0.55)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = band;
    ctx.fillRect(x, bandY - 22, w, 44);
    ctx.restore();

    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.95), 1.75);
    ctx.restore();
  }

  function paddleRgbSplit(ctx, x, y, w, h, o) {
    const heat = o.heat || 0;
    const tick = Math.floor(o.t * 12);
    const glitching = hash(tick) > 0.82 - heat * 0.25;
    const jitter = glitching ? (hash(tick + 3.3) - 0.5) * (6 + heat * 8) : 0;
    const off = 3.5 + heat * 5 + Math.abs(jitter) * 0.5;

    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.8);
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 18;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgb(255,40,90)";
    ctx.fillRect(x - off, y + jitter * 0.4, w, h);
    ctx.fillStyle = "rgb(40,150,255)";
    ctx.fillRect(x + off, y - jitter * 0.4, w, h);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.save();
    ctx.fillStyle = o.hex;
    const slices = 6;
    const sh = h / slices;
    for (let i = 0; i < slices; i++) {
      const sx = glitching ? (hash(i * 7.1 + tick * 1.7) - 0.5) * off * 1.8 : 0;
      ctx.fillRect(x + sx, y + i * sh, w, sh + 0.6);
    }
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(x + w / 2 - 1, y + 5, 2, h - 10);
    strokeFrame(ctx, x, y, w, h, "rgba(255,255,255,0.7)", 1.25);
    ctx.restore();
  }

  const MATRIX_GLYPHS = "01アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF";

  function paddleMatrixRain(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.35);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 12 : 22;
    ctx.fillStyle = rgba(mixRgb(o.rgb, "0,0,0", 0.86), 0.96);
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    const fs = Math.max(8, Math.min(11, Math.round(w * 0.46)));
    ctx.font = `bold ${fs}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const cols = Math.max(2, Math.floor(w / (fs * 0.78)));
    const colW = w / cols;
    const rows = Math.ceil(h / fs) + 1;
    const streak = 7;
    for (let c = 0; c < cols; c++) {
      const speed = 3.2 + hash(c * 13.7) * 2.8;          // rows per second
      const cycle = rows + streak * 2;
      const head = ((o.t * speed + hash(c * 5.1) * cycle) % cycle) - streak;
      for (let k = 0; k < rows; k++) {
        const d = head - k;                               // rows behind the head
        let alpha;
        let color;
        if (d >= 0 && d < 1) { alpha = 0.95; color = "235,255,245"; }
        else if (d >= 1 && d < streak) { alpha = 0.9 * (1 - d / streak); color = light; }
        else { alpha = 0.12; color = o.rgb; }
        const glyph = MATRIX_GLYPHS[Math.floor(hash(c * 31.3 + k * 7.7 + Math.floor(o.t * 6 + c * 0.5)) * MATRIX_GLYPHS.length)];
        ctx.fillStyle = rgba(color, alpha);
        ctx.fillText(glyph, x + colW * (c + 0.5), y + k * fs - 1);
      }
    }
    ctx.restore();

    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.9), 1.5);
    ctx.restore();
  }

  function paddleWireframe(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.5);
    ctx.save();
    ctx.fillStyle = rgba(o.rgb, 0.12);
    ctx.fillRect(x, y, w, h);

    ctx.shadowColor = rgba(o.rgb, 0.95);
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 20;
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.95), 2);
    ctx.shadowBlur = 0;

    // Triangulated mesh
    const rows = Math.max(3, Math.round(h / (w * 0.95)));
    const cellH = h / rows;
    ctx.strokeStyle = rgba(o.rgb, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    for (let r = 0; r <= rows; r++) {
      const yy = y + r * cellH;
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      if (r < rows) {
        if (r % 2 === 0) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy + cellH); }
        else { ctx.moveTo(x + w, yy); ctx.lineTo(x, yy + cellH); }
      }
    }
    ctx.stroke();

    // Scanning pulse sweeps up and down; nearby vertices light up.
    const scanY = y + (Math.sin(o.t * 2.1) * 0.5 + 0.5) * h;
    const scanGrad = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
    scanGrad.addColorStop(0, rgba(light, 0));
    scanGrad.addColorStop(0.5, rgba("255,255,255", 0.55));
    scanGrad.addColorStop(1, rgba(light, 0));
    ctx.fillStyle = scanGrad;
    ctx.fillRect(x + 1, scanY - 10, w - 2, 20);

    for (let r = 0; r <= rows; r++) {
      const yy = y + r * cellH;
      const near = Math.max(0, 1 - Math.abs(yy - scanY) / 26);
      const a = 0.45 + near * 0.55;
      const s = 2 + near * 1.6;
      ctx.fillStyle = near > 0.4 ? rgba("255,255,255", a) : rgba(light, a);
      [x, x + w / 2, x + w].forEach(vx => ctx.fillRect(vx - s / 2, yy - s / 2, s, s));
    }
    ctx.restore();
  }

  function paddleEventHorizon(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.55);
    ctx.save();
    // Glowing halo behind the dark core
    ctx.shadowColor = rgba(o.rgb, 0.95);
    ctx.shadowBlur = (o.quality < 0.55 ? 16 : 32) + Math.max(0, (o.pulse || 0) * 0.3);
    ctx.fillStyle = rgba(o.rgb, 0.95);
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;

    const core = ctx.createLinearGradient(x, 0, x + w, 0);
    core.addColorStop(0, rgba(light, 1));
    core.addColorStop(0.2, rgba(o.rgb, 0.7));
    core.addColorStop(0.4, "rgba(0,0,0,0.98)");
    core.addColorStop(0.6, "rgba(0,0,0,0.98)");
    core.addColorStop(0.8, rgba(o.rgb, 0.7));
    core.addColorStop(1, rgba(light, 1));
    ctx.fillStyle = core;
    ctx.fillRect(x, y, w, h);

    ctx.beginPath();
    ctx.rect(x - 2, y, w + 4, h);
    ctx.clip();

    // Accretion particles orbit the core: bright in front, dim behind.
    const count = o.quality < 0.55 ? 7 : 12;
    for (let i = 0; i < count; i++) {
      const phase = o.t * (2.2 + hash(i) * 1.6) + i * 1.3;
      const travel = (o.t * (18 + hash(i + 5) * 26) + hash(i * 3.1) * h) % h;
      const px = x + w / 2 + Math.sin(phase) * w * 0.46;
      const py = y + travel;
      const front = Math.cos(phase) > 0;
      ctx.fillStyle = front ? "rgba(255,255,255,0.9)" : rgba(o.rgb, 0.35);
      const len = front ? 7 : 4;
      ctx.fillRect(px - 1.25, py - len / 2, 2.5, len);
    }

    // Faint singularity line down the middle
    const flicker = 0.25 + hash(Math.floor(o.t * 20)) * 0.25;
    ctx.fillStyle = rgba(light, flicker);
    ctx.fillRect(x + w / 2 - 0.5, y + 6, 1, h - 12);
    ctx.restore();

    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.85), 1.25);
    ctx.restore();
  }

  const PADDLE_RENDERERS = {
    default: paddleDefault,
    scanline: paddleScanline,
    rgbsplit: paddleRgbSplit,
    matrixrain: paddleMatrixRain,
    wireframe: paddleWireframe,
    eventhorizon: paddleEventHorizon
  };

  function drawPaddleSkin(ctx, skinId, x, y, w, h, o) {
    const opts = Object.assign({ rgb: "0,217,255", hex: "#00d9ff", t: 0, heat: 0, pulse: 0, quality: 1, hits: 0, cracks: 0 }, o || {});
    (PADDLE_RENDERERS[skinId] || paddleDefault)(ctx, x, y, w, h, opts);
    if (opts.gilded) gildPaddle(ctx, x, y, w, h, opts);
  }

  // ─── Ball trails ──────────────────────────────────────────────────────────
  // trail = [{x,y}, ...] newest first (trail[0] is at the ball).
  // o = { r, heat (0-1), rgb (owner colour, or null when neutral), charge, t, quality }

  function trailDefault(ctx, trail, o) {
    const trailScale = Math.min(3, 1 + ((o.charge || 1) - 1) * 0.45);
    ctx.save();
    for (let i = trail.length - 1; i >= 0; i--) {
      const t = trail[i];
      const progress = (trail.length - i) / (trail.length + 1);
      const size = (o.r + o.heat * 0.8) * (1 - progress * 0.25);
      const baseOpacity = (0.05 + progress * 0.15) * (1 + o.heat * 0.35) * trailScale;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      if ((o.charge || 1) >= 2 && o.rgb) {
        ctx.fillStyle   = `rgba(${o.rgb},${Math.min(0.9, baseOpacity * 1.4)})`;
        ctx.shadowColor = `rgba(${o.rgb},0.4)`;
      } else {
        ctx.fillStyle   = `rgba(255,255,255,${baseOpacity})`;
        ctx.shadowColor = `rgba(255,255,255,${0.3 * (1 - progress)})`;
      }
      ctx.shadowBlur = (14 + o.heat * 6) * (1 - progress);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function trailPixelDust(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    const light = mixRgb(rgb, "255,255,255", 0.4);
    const pts = densify(trail, 2);
    ctx.save();
    for (let i = pts.length - 1; i >= 1; i--) {
      const p = pts[i];
      const age = 1 - p.f;
      for (let k = 0; k < 2; k++) {
        const seed = p.x * 0.131 + p.y * 0.717 + k * 9.13;
        const jx = (hash(seed) - 0.5) * o.r * 1.8 * (0.35 + age);
        const jy = (hash(seed + 4.2) - 0.5) * o.r * 1.8 * (0.35 + age) + age * o.r * 0.9;
        const size = Math.max(1.5, o.r * 0.55 * p.f + 1.5);
        const px = Math.round((p.x + jx) / 2) * 2;
        const py = Math.round((p.y + jy) / 2) * 2;
        ctx.fillStyle = rgba(k === 0 ? rgb : light, 0.9 * p.f + 0.05);
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
      }
    }
    ctx.restore();
  }

  function trailGhostFrames(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    ctx.save();
    ctx.lineWidth = 1.5;
    const n = trail.length;
    for (let i = n - 1; i >= 1; i--) {
      if (i % 2 !== 0) continue;
      const p = trail[i];
      const f = 1 - i / n;
      const a = (Math.ceil(f * 4) / 4) * 0.6;           // stepped, not smooth
      const size = o.r * (0.78 + 0.22 * f);
      if (i % 4 === 0) {
        ctx.strokeStyle = rgba("255,60,100", a * 0.45);
        ctx.beginPath(); ctx.arc(p.x - 2, p.y, size, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = rgba("60,220,255", a * 0.45);
        ctx.beginPath(); ctx.arc(p.x + 2, p.y, size, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = rgba(rgb, a * 0.28);
      ctx.fill();
      ctx.strokeStyle = rgba(rgb, a);
      ctx.stroke();
    }
    ctx.restore();
  }

  const DATA_GLYPHS = "0101010110ABCDEF";

  function trailDataStream(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    const light = mixRgb(rgb, "255,255,255", 0.5);
    const pts = resample(trail, Math.max(7, o.r * 1.05));
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      if (p.d < o.r * 1.1) continue;                    // keep clear of the ball
      const size = Math.max(7, Math.round(o.r * (0.8 + 0.6 * p.f)));
      ctx.font = `bold ${size}px monospace`;
      // Glyphs are pinned to distance-from-ball bands so they scroll, not flicker.
      const band = Math.floor(p.d / Math.max(7, o.r * 1.05));
      const glyph = DATA_GLYPHS[Math.floor(hash(band * 3.7 + Math.floor((o.t || 0) * 10) * 0.13) * DATA_GLYPHS.length)];
      ctx.fillStyle = rgba(p.f > 0.7 ? light : rgb, 0.15 + p.f * 0.8);
      ctx.fillText(glyph, p.x, p.y);
    }
    ctx.restore();
  }

  function trailComet(ctx, trail, o) {
    if (trail.length < 2) return;
    const rgb = o.rgb || "255,255,255";
    const light = mixRgb(rgb, "255,255,255", 0.6);
    const n = trail.length;
    const left = [];
    const right = [];
    for (let i = 0; i < n; i++) {
      const p = trail[i];
      const a = trail[Math.max(0, i - 1)];
      const b = trail[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const half = o.r * 0.95 * Math.pow(1 - i / (n - 1), 0.8) + 0.4;
      left.push({ x: p.x - dy * half, y: p.y + dx * half });
      right.push({ x: p.x + dy * half, y: p.y - dx * half });
    }
    const head = trail[0], tail = trail[n - 1];
    const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    grad.addColorStop(0, rgba(light, 0.9));
    grad.addColorStop(0.35, rgba(rgb, 0.55));
    grad.addColorStop(1, rgba(rgb, 0));

    ctx.save();
    ctx.shadowColor = rgba(rgb, 0.8);
    ctx.shadowBlur = (o.quality || 1) < 0.55 ? 0 : 16;
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Hot white core
    const coreGrad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    coreGrad.addColorStop(0, "rgba(255,255,255,0.85)");
    coreGrad.addColorStop(0.6, "rgba(255,255,255,0)");
    ctx.strokeStyle = coreGrad;
    ctx.lineWidth = Math.max(1.5, o.r * 0.3);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    for (let i = 1; i < n; i++) ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();

    // Sparks shed from the tail
    for (let i = 2; i < n; i += 2) {
      const p = trail[i];
      const f = 1 - i / n;
      const seed = p.x * 0.23 + p.y * 0.61;
      ctx.fillStyle = rgba(light, 0.75 * f);
      ctx.fillRect(p.x + (hash(seed) - 0.5) * o.r * 2.6, p.y + (hash(seed + 1.7) - 0.5) * o.r * 2.6, 2, 2);
    }
    ctx.restore();
  }

  function trailGlitchTear(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    const tick = Math.floor((o.t || 0) * 15);
    const colors = [rgb, "255,60,100", "60,230,255"];
    ctx.save();
    const n = trail.length;
    for (let i = n - 1; i >= 1; i--) {
      const p = trail[i];
      const f = 1 - i / n;
      const a = 0.15 + 0.7 * f;
      for (let k = 0; k < 3; k++) {
        const seed = i * 7.3 + k * 2.9 + tick * 1.31;
        const bw = o.r * 2 * (0.9 + hash(seed) * 1.5);
        const bh = Math.max(2, o.r * 0.42);
        const ox = (hash(seed + 5.5) - 0.5) * o.r * 3.2 * (1.4 - f);
        const oy = (k - 1) * o.r * 0.62;
        ctx.fillStyle = rgba(colors[k], k === 0 ? a : a * 0.75);
        ctx.fillRect(p.x - bw / 2 + ox, p.y + oy - bh / 2, bw, bh);
      }
      if (hash(tick * 0.77 + i) > 0.86) {
        ctx.fillStyle = rgba("255,255,255", a * 0.8);
        const tw = o.r * 6;
        ctx.fillRect(p.x - tw / 2 + (hash(tick + i * 3.3) - 0.5) * o.r * 4, p.y - 1, tw, 2);
      }
    }
    ctx.restore();
  }

  function trailHeatSignature(ctx, trail, o) {
    const heat = Math.max(0, Math.min(1, o.heat || 0));
    const base = o.rgb || "103,239,255";
    const warm = "255,140,40";
    const hot = "255,246,220";
    const core = heat < 0.5 ? mixRgb(base, warm, heat * 2) : mixRgb(warm, hot, (heat - 0.5) * 2);
    const edge = heat < 0.5 ? mixRgb(base, "255,80,30", heat * 1.4) : mixRgb("255,80,30", warm, (heat - 0.5) * 2);
    const pts = densify(trail, 2);
    const tick = (o.t || 0) * 9;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = pts.length - 1; i >= 1; i--) {
      const p = pts[i];
      const age = 1 - p.f;
      const flick = hash(i * 1.9 + Math.floor(tick)) - 0.5;
      const size = o.r * (0.55 + age * 0.9) * (0.85 + heat * 0.45) * (1 + flick * 0.2);
      const py = p.y - age * o.r * 1.4 * (0.3 + heat);
      const px = p.x + flick * o.r * 0.5 * age;
      const g = ctx.createRadialGradient(px, py, 0, px, py, size);
      g.addColorStop(0, rgba(core, 0.55 * p.f + 0.08));
      g.addColorStop(0.55, rgba(edge, 0.3 * p.f + 0.04));
      g.addColorStop(1, rgba(edge, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const TRAIL_RENDERERS = {
    default: trailDefault,
    pixeldust: trailPixelDust,
    ghostframes: trailGhostFrames,
    datastream: trailDataStream,
    comet: trailComet,
    glitchtear: trailGlitchTear,
    heattrail: trailHeatSignature
  };

  function drawBallTrail(ctx, trailId, trail, o) {
    if (!trail || trail.length === 0) return;
    const opts = Object.assign({ r: 10, heat: 0, rgb: null, charge: 1, t: 0, quality: 1, speed: 6, rally: 0 }, o || {});
    (TRAIL_RENDERERS[trailId] || trailDefault)(ctx, trail, opts);
    if (opts.gilded) gildTrail(ctx, trail, opts);
  }

  // ═══ More paddle skins ═══════════════════════════════════════════════════
  // o also carries ballY (screen y of the ball) and hitFlash (1 → 0 after a return).

  function paddleStatic(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.6);
    const tick = Math.floor(o.t * 24);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.85);
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 20;
    ctx.fillStyle = "rgb(18,20,26)";
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    const cell = 3;
    for (let cy = 0; cy < h; cy += cell) {
      for (let cx = 0; cx < w; cx += cell) {
        const n = hash(cx * 1.7 + cy * 0.37 + tick * 13.1);
        if (n < 0.35) continue;
        const g = Math.round(90 + n * 150);
        ctx.fillStyle = `rgba(${g},${g},${g},${0.25 + n * 0.55})`;
        ctx.fillRect(x + cx, y + cy, cell, cell);
      }
    }
    // a slow rolling bar, like a badly tuned set
    const bar = y + ((o.t * 0.35) % 1) * h;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x, bar, w, 6);
    // stuck pixels in the paddle's colour never change
    ctx.fillStyle = rgba(light, 0.95);
    [0.17, 0.43, 0.71, 0.88].forEach((fy, i) => ctx.fillRect(x + (i % 2 ? w * 0.65 : w * 0.25), y + fy * h, 3, 3));
    ctx.globalAlpha = 0.9;
    strokeFrame(ctx, x, y, w, h, rgba(o.rgb, 1), 2);
    ctx.restore();
  }

  function paddleCircuit(ctx, x, y, w, h, o) {
    const flash = o.hitFlash || 0;
    const light = mixRgb(o.rgb, "255,255,255", 0.5);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.85 + flash * 0.15);
    ctx.shadowBlur = (o.quality < 0.55 ? 12 : 22) + flash * 18;
    ctx.fillStyle = rgba(mixRgb(o.rgb, "4,22,14", 0.82), 1);
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    // fixed traces: each lane jogs sideways once, with a pad at each end
    const lanes = [0.25, 0.5, 0.75];
    ctx.lineWidth = 1.5;
    lanes.forEach((lx, i) => {
      const jog = (hash(i * 9.1) - 0.5) * w * 0.4;
      const yA = y + h * (0.15 + hash(i * 3.3) * 0.25);
      const yB = y + h * (0.6 + hash(i * 5.7) * 0.3);
      const px = x + w * lx;
      ctx.strokeStyle = rgba(o.rgb, 0.55 + flash * 0.45);
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, yA);
      ctx.lineTo(px + jog, yA + 8);
      ctx.lineTo(px + jog, yB);
      ctx.lineTo(px, yB + 8);
      ctx.lineTo(px, y + h);
      ctx.stroke();
      ctx.fillStyle = rgba(light, 0.85);
      ctx.fillRect(px + jog - 2, yA + 6, 4, 4);
      ctx.fillRect(px + jog - 2, yB - 2, 4, 4);
      // a pulse of light travels the lane
      const py = y + ((o.t * (0.6 + i * 0.25) + hash(i)) % 1) * h;
      ctx.fillStyle = rgba("255,255,255", 0.9);
      ctx.fillRect(px - 1.5 + (py > yA && py < yB ? jog : 0), py - 3, 3, 6);
    });
    if (flash > 0) {
      ctx.fillStyle = rgba(light, flash * 0.35);
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.9), 1.5);
    ctx.restore();
  }

  function paddlePlasma(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.55);
    const alt = mixRgb(o.rgb, "255,60,200", 0.55);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 14 : 26;
    ctx.fillStyle = rgba(mixRgb(o.rgb, "0,0,0", 0.7), 1);
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    const cell = o.quality < 0.55 ? 6 : 4;
    const t = o.t;
    for (let cy = 0; cy < h; cy += cell) {
      for (let cx = 0; cx < w; cx += cell) {
        const v = Math.sin(cx * 0.35 + t * 1.7) + Math.sin(cy * 0.09 - t * 2.3) + Math.sin((cx + cy) * 0.12 + t * 1.1);
        const k = (v + 3) / 6;
        ctx.fillStyle = rgba(k > 0.55 ? mixRgb(light, alt, (k - 0.55) * 2.2) : o.rgb, 0.25 + k * 0.75);
        ctx.fillRect(x + cx, y + cy, cell, cell);
      }
    }
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.9), 1.5);
    ctx.restore();
  }

  function paddleHoloFoil(ctx, x, y, w, h, o) {
    const shift = (o.t * 0.25 + (o.ballY || 0) * 0.0015) % 1;
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 12 : 24;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    for (let i = 0; i <= 6; i++) {
      const hue = ((i / 6 + shift) % 1) * 360;
      g.addColorStop(i / 6, `hsl(${hue},85%,68%)`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    // the team colour washes over the foil so each side stays readable
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = rgba(o.rgb, 1);
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const sy = y - 40 + ((o.t * 0.6) % 1) * (h + 80);
    const shine = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
    shine.addColorStop(0, "rgba(255,255,255,0)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.7)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(x, sy - 30, w, 60);
    ctx.restore();
    ctx.save();
    strokeFrame(ctx, x, y, w, h, "rgba(255,255,255,0.85)", 1.5);
    ctx.restore();
  }

  function paddleWatcher(ctx, x, y, w, h, o) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 12 : 24;
    ctx.fillStyle = "rgb(24,8,14)";
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    // vein lines toward the ends
    ctx.strokeStyle = "rgba(255,70,90,0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const dir = i < 3 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + (hash(i) - 0.5) * w * 0.5, cy + dir * w * 0.5);
      ctx.lineTo(cx + (hash(i + 2) - 0.5) * w * 0.8, cy + dir * h * (0.25 + hash(i + 7) * 0.2));
      ctx.stroke();
    }
    // the eye: blinks every few seconds, iris follows the ball
    const blinkPhase = (o.t % 4.3);
    const open = blinkPhase < 0.12 ? Math.abs(blinkPhase - 0.06) / 0.06 : 1;
    const ew = w * 0.42;
    const eh = w * 0.95 * Math.max(0.08, open);
    ctx.fillStyle = "rgba(255,240,240,0.95)";
    ctx.beginPath(); ctx.ellipse(cx, cy, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
    const look = Math.max(-1, Math.min(1, ((o.ballY == null ? cy : o.ballY) - cy) / (h * 1.5)));
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, ew, eh, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = rgba(o.rgb, 1);
    ctx.beginPath(); ctx.arc(cx, cy + look * eh * 0.45, ew * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgb(8,0,4)";
    ctx.beginPath(); ctx.arc(cx, cy + look * eh * 0.5, ew * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(cx - ew * 0.25, cy + look * eh * 0.5 - ew * 0.35, 2, 2);
    ctx.restore();
    strokeFrame(ctx, x, y, w, h, rgba(o.rgb, 0.95), 1.75);
    ctx.restore();
  }

  function paddleGoldCore(ctx, x, y, w, h, o) {
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 12 : 26;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "#7a5410");
    g.addColorStop(0.3, "#f6d77a");
    g.addColorStop(0.55, "#fff4c4");
    g.addColorStop(0.75, "#d9a632");
    g.addColorStop(1, "#6b4608");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const sy = y - 50 + ((o.t * 0.45) % 1) * (h + 100);
    ctx.translate(x + w / 2, sy);
    ctx.rotate(-0.5);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(-w, -4, w * 2, 8);
    ctx.restore();
    ctx.save();
    // team colour on the bezel so the gold still says whose paddle it is
    strokeFrame(ctx, x, y, w, h, rgba(o.rgb, 1), 2.5);
    ctx.restore();
  }

  Object.assign(PADDLE_RENDERERS, {
    static: paddleStatic,
    circuit: paddleCircuit,
    plasma: paddlePlasma,
    holofoil: paddleHoloFoil,
    watcher: paddleWatcher,
    goldcore: paddleGoldCore
  });

  // ═══ More ball trails ════════════════════════════════════════════════════

  function trailSonar(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    ctx.save();
    ctx.lineWidth = 1.5;
    const n = trail.length;
    for (let i = n - 1; i >= 1; i--) {
      if (i % 3 !== 0) continue;
      const p = trail[i];
      const age = i / n;
      ctx.strokeStyle = rgba(rgb, 0.75 * (1 - age));
      ctx.beginPath();
      ctx.arc(p.x, p.y, o.r * (0.6 + age * 2.2), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function trailLightning(ctx, trail, o) {
    if (trail.length < 2) return;
    const rgb = o.rgb || "160,220,255";
    const tick = Math.floor((o.t || 0) * 30);
    const pts = resample(trail, Math.max(6, o.r * 0.9));
    if (!pts.length) return;
    const path = (jitter, seed) => {
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      pts.forEach((p, i) => {
        const j = (hash(i * 3.1 + seed + tick * 1.7) - 0.5) * jitter * (1 - p.f * 0.5);
        ctx.lineTo(p.x + j * 0.4, p.y + j);
      });
    };
    ctx.save();
    ctx.lineJoin = "round";
    ctx.shadowColor = rgba(rgb, 0.9);
    ctx.shadowBlur = (o.quality || 1) < 0.55 ? 0 : 14;
    ctx.strokeStyle = rgba(rgb, 0.8);
    ctx.lineWidth = 3;
    path(o.r * 1.6, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.2;
    path(o.r * 1.6, 0);
    ctx.stroke();
    // a fork that branches off now and then
    if (hash(tick * 0.31) > 0.4 && pts.length > 3) {
      const at = pts[Math.floor(pts.length / 2)];
      ctx.strokeStyle = rgba(rgb, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(at.x, at.y);
      ctx.lineTo(at.x + (hash(tick) - 0.5) * o.r * 3, at.y + (hash(tick + 1) > 0.5 ? 1 : -1) * o.r * 2.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function trailHelix(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    const alt = mixRgb(rgb, "255,255,255", 0.6);
    const pts = resample(trail, 3);
    if (pts.length < 2) return;
    const phase = (o.t || 0) * 10;
    ctx.save();
    for (let strand = 0; strand < 2; strand++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const amp = o.r * 0.9 * b.f + 1;
        const wa = Math.sin(a.d * 0.18 - phase + strand * Math.PI) * amp;
        const wb = Math.sin(b.d * 0.18 - phase + strand * Math.PI) * amp;
        ctx.strokeStyle = rgba(strand ? alt : rgb, 0.15 + 0.8 * b.f);
        ctx.lineWidth = 1 + b.f * 2.2;
        ctx.beginPath();
        ctx.moveTo(a.x + nx * wa, a.y + ny * wa);
        ctx.lineTo(b.x + nx * wb, b.y + ny * wb);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function trailSparkler(ctx, trail, o) {
    const rgb = o.rgb || "255,220,150";
    const tick = Math.floor((o.t || 0) * 40);
    ctx.save();
    ctx.lineCap = "round";
    const n = trail.length;
    for (let i = 1; i < n; i++) {
      const p = trail[i];
      const f = 1 - i / n;
      for (let k = 0; k < 2; k++) {
        const seed = i * 4.7 + k * 1.3 + tick * 0.77;
        const ang = hash(seed) * Math.PI * 2;
        const len = o.r * (0.5 + hash(seed + 2) * 1.6) * (0.4 + f);
        ctx.strokeStyle = k ? rgba("255,240,200", 0.9 * f) : rgba(rgb, 0.85 * f);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  const RAINBOW = ["255,60,90", "255,170,40", "255,240,80", "70,235,120", "80,170,255"];

  function trailRainbow(ctx, trail, o) {
    const pts = resample(trail, 3);
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineCap = "butt";
    RAINBOW.forEach((col, band) => {
      const off = (band - 2) * 0.42;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const wa = off * o.r * (0.35 + a.f * 0.65), wb = off * o.r * (0.35 + b.f * 0.65);
        ctx.strokeStyle = rgba(col, 0.2 + 0.75 * b.f);
        ctx.lineWidth = Math.max(1, o.r * 0.42 * (0.4 + b.f * 0.6));
        ctx.beginPath();
        ctx.moveTo(a.x + nx * wa, a.y + ny * wa);
        ctx.lineTo(b.x + nx * wb, b.y + ny * wb);
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  function trailGravityWake(ctx, trail, o) {
    const rgb = o.rgb || "180,140,255";
    const n = trail.length;
    ctx.save();
    for (let i = n - 1; i >= 1; i--) {
      const p = trail[i];
      const f = 1 - i / n;
      const r = o.r * (0.5 + f * 0.7);
      // lensed rim, then the dark core on top
      ctx.strokeStyle = rgba(rgb, 0.55 * f);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.45, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(0,0,0,${0.7 * f})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
    // matter spiralling into the wake
    const t = o.t || 0;
    for (let i = 2; i < n; i += 2) {
      const p = trail[i];
      const f = 1 - i / n;
      const ang = t * 6 + i;
      const d = o.r * (1.6 + (1 - f));
      ctx.fillStyle = rgba(mixRgb(rgb, "255,255,255", 0.5), 0.8 * f);
      ctx.fillRect(p.x + Math.cos(ang) * d - 1, p.y + Math.sin(ang) * d - 1, 2, 2);
    }
    ctx.restore();
  }

  Object.assign(TRAIL_RENDERERS, {
    sonar: trailSonar,
    lightning: trailLightning,
    helix: trailHelix,
    sparkler: trailSparkler,
    rainbow: trailRainbow,
    gravitywake: trailGravityWake
  });

  // ═══ Ball skins ══════════════════════════════════════════════════════════
  // The hitbox is always the plain circle of radius r; skins only change the
  // look. o = { rgb, hex, glowBlur, glowAlpha, t, vx, vy, quality }

  function glow(ctx, o) {
    ctx.shadowColor = rgba(o.rgb, o.glowAlpha == null ? 0.8 : o.glowAlpha);
    ctx.shadowBlur = (o.glowBlur == null ? 22 : o.glowBlur) * ((o.quality || 1) < 0.55 ? 0.6 : 1);
  }

  function ballDefault(ctx, x, y, r, o) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = o.hex;
    ctx.shadowColor = rgba(o.rgb, o.glowAlpha == null ? 0.8 : o.glowAlpha);
    ctx.shadowBlur = o.glowBlur == null ? 22 : o.glowBlur;
    ctx.fill();
  }

  function ballPixelCube(ctx, x, y, r, o) {
    const s = r * 1.75;
    ctx.translate(x, y);
    ctx.rotate((o.t || 0) * 3.2);
    glow(ctx, o);
    ctx.fillStyle = o.hex;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(mixRgb(o.rgb, "0,0,0", 0.45), 0.9);
    ctx.fillRect(-s / 4, -s / 4, s / 2, s / 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(-s / 2, -s / 2, s * 0.22, s * 0.22);
  }

  function ballGlitchOrb(ctx, x, y, r, o) {
    const tick = Math.floor((o.t || 0) * 14);
    const jump = hash(tick) > 0.8 ? (hash(tick + 1) - 0.5) * r : 0;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,40,90,0.75)";
    ctx.beginPath(); ctx.arc(x - r * 0.32 + jump, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(40,160,255,0.75)";
    ctx.beginPath(); ctx.arc(x + r * 0.32 - jump, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    glow(ctx, o);
    ctx.fillStyle = o.hex;
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(x - r, y - 1 + jump * 0.5, r * 2, 2);
  }

  function ballWireOrb(ctx, x, y, r, o) {
    const t = o.t || 0;
    const light = mixRgb(o.rgb, "255,255,255", 0.5);
    glow(ctx, o);
    ctx.fillStyle = rgba(o.rgb, 0.25);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(light, 0.95);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    [-0.5, 0, 0.5].forEach((ly) => {
      const ry = r * Math.sqrt(1 - ly * ly);
      ctx.beginPath(); ctx.ellipse(x, y + ly * r, ry, ry * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    });
    for (let i = 0; i < 3; i++) {
      const rx = Math.abs(Math.cos(t * 2.4 + i * Math.PI / 3)) * r;
      ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), r, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function ballVinyl(ctx, x, y, r, o) {
    const t = o.t || 0;
    glow(ctx, o);
    ctx.fillStyle = "rgb(14,14,18)";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 0.8;
    for (let k = 0.55; k < 0.98; k += 0.14) { ctx.beginPath(); ctx.arc(x, y, r * k, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, t * 8, t * 8 + 0.7); ctx.stroke();
    ctx.fillStyle = o.hex;
    ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgb(14,14,18)";
    ctx.beginPath(); ctx.arc(x, y, r * 0.09, 0, Math.PI * 2); ctx.fill();
  }

  function ballEightBall(ctx, x, y, r, o) {
    glow(ctx, o);
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, "rgb(90,90,100)");
    g.addColorStop(0.4, "rgb(20,20,26)");
    g.addColorStop(1, "rgb(4,4,6)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(o.rgb, 0.95);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgb(245,245,245)";
    ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgb(10,10,12)";
    ctx.font = `bold ${Math.max(6, Math.round(r * 0.72))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("8", x, y + r * 0.04);
  }

  function ballMiniEye(ctx, x, y, r, o) {
    const speed = Math.hypot(o.vx || 0, o.vy || 0) || 1;
    const lx = ((o.vx || 0) / speed) * r * 0.32;
    const ly = ((o.vy || 0) / speed) * r * 0.32;
    glow(ctx, o);
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, "rgb(255,250,250)");
    g.addColorStop(1, "rgb(255,190,200)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = o.hex;
    ctx.beginPath(); ctx.arc(x + lx, y + ly, r * 0.52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgb(10,0,6)";
    ctx.beginPath(); ctx.arc(x + lx * 1.15, y + ly * 1.15, r * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(x + lx - r * 0.2, y + ly - r * 0.22, r * 0.1, 0, Math.PI * 2); ctx.fill();
  }

  const BALL_RENDERERS = {
    default: ballDefault, pixelcube: ballPixelCube, glitchorb: ballGlitchOrb, wireorb: ballWireOrb,
    vinyl: ballVinyl, eightball: ballEightBall, minieye: ballMiniEye
  };

  function drawBallSkin(ctx, skinId, x, y, r, o) {
    const opts = Object.assign({ rgb: "255,255,255", hex: "#ffffff", t: 0, vx: 1, vy: 0, quality: 1, heat: 0, face: 0, final: false }, o || {});
    ctx.save();
    (BALL_RENDERERS[skinId] || ballDefault)(ctx, x, y, r, opts);
    ctx.restore();
    if (opts.gilded) gildBall(ctx, x, y, r, opts);
  }

  // ═══ Dash effects ════════════════════════════════════════════════════════
  // trail = the game's dash afterimages [{x, y, life}] (life counts down from
  // 8/12/16 frames). o = { w, h, rgb, legacyRgb, heat, t, curY, quality }

  function dashDefault(ctx, trail, o) {
    const col = o.legacyRgb || o.rgb;
    for (const tr of trail) {
      const alpha = Math.max(0, tr.life / 16) * (0.18 + o.heat * 0.14);
      ctx.fillStyle = `rgba(${col},${alpha})`;
      ctx.shadowColor = `rgba(${col},${alpha * 1.4})`;
      ctx.shadowBlur = 16;
      ctx.fillRect(tr.x, tr.y, o.w, o.h);
      ctx.shadowBlur = 0;
    }
  }

  function dashLife(trail) { return trail.reduce((m, tr) => Math.max(m, tr.life), 0) / 16; }

  function dashSmear(ctx, trail, o) {
    if (!trail.length) return;
    const k = dashLife(trail);
    const far = trail.reduce((a, tr) => (Math.abs(tr.y - o.curY) > Math.abs(a.y - o.curY) ? tr : a), trail[0]);
    const top = Math.min(far.y, o.curY);
    const bottom = Math.max(far.y, o.curY) + o.h;
    const g = ctx.createLinearGradient(0, far.y + o.h / 2, 0, o.curY + o.h / 2);
    g.addColorStop(0, rgba(o.rgb, 0.12 * k));
    g.addColorStop(1, rgba(mixRgb(o.rgb, "255,255,255", 0.3), 0.8 * k));
    ctx.fillStyle = g;
    ctx.shadowColor = rgba(o.rgb, 0.7 * k);
    ctx.shadowBlur = 14;
    ctx.fillRect(far.x + 1, top, o.w - 2, bottom - top);
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba("255,255,255", 0.5 * k);
    ctx.fillRect(far.x + o.w / 2 - 1, top, 2, bottom - top);
  }

  function dashSpeedLines(ctx, trail, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.5);
    ctx.lineWidth = 1.5;
    trail.forEach((tr, i) => {
      const a = Math.max(0, tr.life / 16);
      for (let j = 0; j < 4; j++) {
        const lx = tr.x + o.w * (0.15 + j * 0.23) + (hash(i * 3 + j) - 0.5) * 4;
        const len = o.h * (0.5 + hash(j + i * 7) * 0.9);
        const ly = tr.y + (o.h - len) / 2;
        ctx.strokeStyle = rgba(j % 2 ? light : o.rgb, 0.7 * a);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + len); ctx.stroke();
      }
    });
  }

  function dashGhostClones(ctx, trail, o) {
    ctx.lineWidth = 1.5;
    trail.forEach((tr) => {
      const a = Math.max(0, tr.life / 16);
      ctx.strokeStyle = rgba("255,60,100", 0.6 * a);
      ctx.strokeRect(tr.x - 3, tr.y, o.w, o.h);
      ctx.strokeStyle = rgba("60,220,255", 0.6 * a);
      ctx.strokeRect(tr.x + 3, tr.y, o.w, o.h);
      ctx.strokeStyle = rgba(o.rgb, 0.9 * a);
      ctx.strokeRect(tr.x, tr.y, o.w, o.h);
      ctx.fillStyle = rgba(o.rgb, 0.12 * a);
      ctx.fillRect(tr.x, tr.y, o.w, o.h);
    });
  }

  function dashPixelScatter(ctx, trail, o) {
    const cell = 4;
    trail.forEach((tr, i) => {
      const a = Math.max(0, tr.life / 16);
      const spread = (1 - a) * 22;
      for (let cy = 0; cy < o.h; cy += cell) {
        for (let cx = 0; cx < o.w; cx += cell) {
          const n = hash(cx * 0.7 + cy * 1.3 + i * 17.1);
          if (n > a) continue;
          const ang = n * Math.PI * 2;
          ctx.fillStyle = rgba(n > 0.5 ? o.rgb : mixRgb(o.rgb, "255,255,255", 0.5), 0.75 * a);
          ctx.fillRect(tr.x + cx + Math.cos(ang) * spread, tr.y + cy + Math.sin(ang) * spread, cell - 1, cell - 1);
        }
      }
    });
  }

  function dashAfterburn(ctx, trail, o) {
    ctx.globalCompositeOperation = "lighter";
    trail.forEach((tr, i) => {
      const a = Math.max(0, tr.life / 16);
      const cx = tr.x + o.w / 2;
      const cy = tr.y + o.h / 2;
      const flick = 0.85 + hash(i + Math.floor(o.t * 30)) * 0.3;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, o.h * 0.7 * flick);
      g.addColorStop(0, rgba("255,240,200", 0.55 * a));
      g.addColorStop(0.35, rgba("255,140,40", 0.45 * a));
      g.addColorStop(1, rgba(o.rgb, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy, o.w * 1.2, o.h * 0.65 * flick, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalCompositeOperation = "source-over";
  }

  const DASH_RENDERERS = {
    default: dashDefault, smear: dashSmear, speedlines: dashSpeedLines, ghostclones: dashGhostClones,
    pixelscatter: dashPixelScatter, afterburn: dashAfterburn
  };

  function drawDash(ctx, id, trail, o) {
    if (!trail || !trail.length) return;
    const opts = Object.assign({ w: 22, h: 140, rgb: "0,217,255", heat: 0, t: 0, curY: trail[0].y, quality: 1 }, o || {});
    ctx.save();
    (DASH_RENDERERS[id] || dashDefault)(ctx, trail, opts);
    ctx.restore();
    if (opts.gilded) gildDash(ctx, trail, opts);
  }

  // ═══ One-shot effects: hits, scores, teleports, victories ════════════════
  // Each effect is drawn from its age alone (k = 0 → 1 over its life), so it
  // needs no per-frame state and plays the same in the game and the Store.
  //   hit:      x,y = contact point, o.dir = +1 moving right / −1 moving left
  //   score:    x,y = where the ball left, o.dir points back into the court
  //   teleport: x,y = where the ball vanished, o.to = where it reappeared

  const ease = (k) => 1 - Math.pow(1 - k, 3);
  const GLYPHS = "01<>/#{}[]$%&";

  function burstDirs(e, count, spread, seedOff = 0) {
    const base = (e.o.dir || 1) > 0 ? 0 : Math.PI;
    const out = [];
    for (let j = 0; j < count; j++) {
      const s = e.seed + j * 7.13 + seedOff;
      out.push({ ang: base + (hash(s) - 0.5) * spread, spd: hash(s + 1.1), size: hash(s + 2.2), s });
    }
    return out;
  }

  const FX = {
    hit: {
      shockring: { life: 0.45, draw(ctx, e, k) {
        const rgb = e.o.rgb, r = e.o.r || 10;
        ctx.lineWidth = 3 * (1 - k) + 0.5;
        ctx.strokeStyle = rgba(rgb, 1 - k);
        ctx.beginPath(); ctx.arc(e.x, e.y, r * (1 + ease(k) * 4.5), 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = rgba("255,255,255", (1 - k) * 0.8);
        ctx.beginPath(); ctx.arc(e.x, e.y, r * (1 + ease(k) * 2.4), 0, Math.PI * 2); ctx.stroke();
      } },
      shards: { life: 0.6, draw(ctx, e, k, age) {
        burstDirs(e, 11, Math.PI * 1.2).forEach((d, j) => {
          const dist = (120 + d.spd * 260) * age;
          const px = e.x + Math.cos(d.ang) * dist;
          const py = e.y + Math.sin(d.ang) * dist + 160 * age * age;
          const sz = 4 + d.size * 6;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(age * (8 + d.spd * 10) * (j % 2 ? 1 : -1));
          ctx.fillStyle = rgba(j % 3 ? e.o.rgb : "255,255,255", 1 - k);
          ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * 0.6, sz * 0.7); ctx.lineTo(-sz * 0.5, sz * 0.4); ctx.closePath(); ctx.fill();
          ctx.restore();
        });
      } },
      pixelpop: { life: 0.7, draw(ctx, e, k, age) {
        burstDirs(e, 16, Math.PI * 1.4).forEach((d, j) => {
          const v = 120 + d.spd * 240;
          const px = e.x + Math.cos(d.ang) * v * age;
          const py = e.y + Math.sin(d.ang) * v * age + 420 * age * age;
          const sz = Math.round(3 + d.size * 4);
          ctx.fillStyle = rgba(j % 2 ? e.o.rgb : mixRgb(e.o.rgb, "255,255,255", 0.6), 1 - k * k);
          ctx.fillRect(Math.round(px / 2) * 2, Math.round(py / 2) * 2, sz, sz);
        });
      } },
      glyphs: { life: 0.8, draw(ctx, e, k, age) {
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        burstDirs(e, 9, Math.PI * 1.1).forEach((d) => {
          const v = 60 + d.spd * 120;
          ctx.fillStyle = rgba(d.size > 0.5 ? e.o.rgb : "255,255,255", 1 - k);
          ctx.fillText(GLYPHS[Math.floor(d.size * GLYPHS.length)], e.x + Math.cos(d.ang) * v * age, e.y + Math.sin(d.ang) * v * age - 40 * age);
        });
      } },
      arcflash: { life: 0.35, draw(ctx, e, k) {
        const r = e.o.r || 10;
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 6);
        g.addColorStop(0, `rgba(255,255,255,${0.85 * (1 - k)})`);
        g.addColorStop(0.3, rgba(e.o.rgb, 0.5 * (1 - k)));
        g.addColorStop(1, rgba(e.o.rgb, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(e.x, e.y, r * 6, 0, Math.PI * 2); ctx.fill();
        const tick = Math.floor(k * 12);
        ctx.strokeStyle = rgba("255,255,255", 1 - k);
        ctx.shadowColor = rgba(e.o.rgb, 1);
        ctx.shadowBlur = 10;
        ctx.lineWidth = 1.5;
        burstDirs(e, 5, Math.PI * 1.3).forEach((d) => {
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          let px = e.x, py = e.y;
          const len = r * (3 + d.spd * 4);
          for (let s = 1; s <= 4; s++) {
            px = e.x + Math.cos(d.ang) * len * s / 4 + (hash(d.s + s + tick) - 0.5) * r * 1.6;
            py = e.y + Math.sin(d.ang) * len * s / 4 + (hash(d.s + s * 2 + tick) - 0.5) * r * 1.6;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        });
      } }
    },

    score: {
      shockwave: { life: 0.9, draw(ctx, e, k) {
        const R = (e.o.h || 600) * 0.75 * ease(k);
        ctx.lineWidth = 8 * (1 - k) + 1;
        ctx.strokeStyle = rgba(e.o.rgb, 0.9 * (1 - k));
        ctx.beginPath(); ctx.arc(e.x, e.y, R, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 3 * (1 - k) + 0.5;
        ctx.strokeStyle = rgba("255,255,255", 0.8 * (1 - k));
        ctx.beginPath(); ctx.arc(e.x, e.y, R * 0.7, 0, Math.PI * 2); ctx.stroke();
      } },
      pixelburst: { life: 1.0, draw(ctx, e, k, age) {
        burstDirs(e, 46, Math.PI * 1.05).forEach((d, j) => {
          const v = 180 + d.spd * 520;
          const px = e.x + Math.cos(d.ang) * v * age;
          const py = e.y + Math.sin(d.ang) * v * age + 300 * age * age;
          const sz = Math.round(4 + d.size * 6);
          ctx.fillStyle = rgba(j % 3 === 0 ? "255,255,255" : e.o.rgb, 1 - k);
          ctx.fillRect(Math.round(px / 3) * 3, Math.round(py / 3) * 3, sz, sz);
        });
      } },
      binaryspill: { life: 1.4, draw(ctx, e, k, age) {
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        burstDirs(e, 30, Math.PI * 0.9).forEach((d) => {
          const v = 80 + d.spd * 260;
          const delay = d.size * 0.3;
          const a = Math.max(0, age - delay);
          if (a <= 0) return;
          const px = e.x + Math.cos(d.ang) * v * a;
          const py = e.y + Math.sin(d.ang) * v * a + 260 * a * a;
          ctx.fillStyle = rgba(d.spd > 0.5 ? e.o.rgb : "160,255,190", 1 - k);
          ctx.fillText(d.size > 0.5 ? "1" : "0", px, py);
        });
      } },
      fireworks: { life: 1.6, draw(ctx, e, k, age) {
        const dir = e.o.dir || 1;
        const cols = [e.o.rgb, "255,210,102", "255,255,255"];
        for (let rk = 0; rk < 3; rk++) {
          const s = e.seed + rk * 31.7;
          const tx = e.x + dir * (90 + hash(s) * 220);
          const ty = e.y - 80 - hash(s + 1) * 180;
          const launch = 0.45 + rk * 0.12;
          if (age < launch) {
            const q = ease(age / launch);
            const q0 = ease(Math.max(0, age - 0.06) / launch);
            ctx.strokeStyle = rgba("255,240,200", 0.95);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(e.x + (tx - e.x) * q0, e.y + (ty - e.y) * q0);
            ctx.lineTo(e.x + (tx - e.x) * q, e.y + (ty - e.y) * q);
            ctx.stroke();
            continue;
          }
          const b = age - launch;
          const life = 1.6 - launch;
          const fade = Math.max(0, 1 - b / life);
          if (b < 0.08) {
            ctx.fillStyle = rgba("255,255,255", 0.8 * (1 - b / 0.08));
            ctx.beginPath(); ctx.arc(tx, ty, 26, 0, Math.PI * 2); ctx.fill();
          }
          for (let j = 0; j < 26; j++) {
            const ang = (j / 26) * Math.PI * 2 + hash(s + j) * 0.3;
            const v = 110 + hash(s + j * 3) * 90;
            ctx.fillStyle = rgba(cols[(j + rk) % 3], fade);
            ctx.fillRect(tx + Math.cos(ang) * v * b - 2.5, ty + Math.sin(ang) * v * b + 70 * b * b - 2.5, 5, 5);
          }
        }
      } },
      signalloss: { life: 0.75, draw(ctx, e, k) {
        const W = e.o.w || 1000, H = e.o.h || 600;
        const tick = Math.floor(k * 18);
        const a = Math.sin(Math.PI * Math.min(1, k * 1.2));
        for (let i = 0; i < 14; i++) {
          const s = e.seed + i * 5.3 + tick * 0.71;
          const by = hash(s) * H;
          const bh = 4 + hash(s + 1) * 26;
          const off = (hash(s + 2) - 0.5) * W * 0.25;
          ctx.fillStyle = i % 3 === 0 ? rgba("255,255,255", 0.35 * a) : i % 3 === 1 ? rgba(e.o.rgb, 0.4 * a) : `rgba(0,0,0,${0.55 * a})`;
          ctx.fillRect(off, by, W, bh);
        }
        ctx.fillStyle = rgba("255,255,255", 0.12 * a);
        for (let y = (tick * 7) % 6; y < H; y += 6) ctx.fillRect(0, y, W, 1);
      } }
    },

    teleport: {
      pixelate: { life: 0.5, draw(ctx, e, k) {
        const r = e.o.r || 10;
        const cell = Math.max(3, r * 0.5);
        const to = e.o.to || e;
        for (let gy = -2; gy < 2; gy++) {
          for (let gx = -2; gx < 2; gx++) {
            const n = hash(e.seed + gx * 3.1 + gy * 7.7);
            const ang = n * Math.PI * 2;
            const out = ease(k) * r * 3;
            ctx.fillStyle = rgba(e.o.rgb, 1 - k);
            ctx.fillRect(e.x + gx * cell + Math.cos(ang) * out, e.y + gy * cell + Math.sin(ang) * out, cell - 1, cell - 1);
            const inn = (1 - ease(k)) * r * 3;
            ctx.fillStyle = rgba(e.o.rgb, Math.min(1, k * 2) * (1 - k * 0.5));
            ctx.fillRect(to.x + gx * cell + Math.cos(ang) * inn, to.y + gy * cell + Math.sin(ang) * inn, cell - 1, cell - 1);
          }
        }
      } },
      staticburst: { life: 0.45, draw(ctx, e, k) {
        const r = (e.o.r || 10) * 3.2;
        const tick = Math.floor(k * 20);
        [e, e.o.to || e].forEach((p, w) => {
          for (let j = 0; j < 40; j++) {
            const s = e.seed + j * 2.7 + tick * 13.3 + w * 99;
            if (hash(s) < k) continue;
            const ang = hash(s + 1) * Math.PI * 2;
            const d = Math.sqrt(hash(s + 2)) * r;
            const g = Math.round(150 + hash(s + 3) * 105);
            ctx.fillStyle = j % 4 === 0 ? rgba(e.o.rgb, 0.9) : `rgba(${g},${g},${g},0.85)`;
            ctx.fillRect(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d, 3, 3);
          }
        });
      } },
      portal: { life: 0.7, draw(ctx, e, k) {
        const r = e.o.r || 10;
        const open = Math.sin(Math.PI * k);
        [e, e.o.to || e].forEach((p) => {
          for (let ring = 0; ring < 3; ring++) {
            ctx.strokeStyle = rgba(ring === 1 ? "255,255,255" : e.o.rgb, 0.9 * open);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, r * (0.9 + ring * 0.35) * open, r * (2.1 + ring * 0.5) * open, k * 6 + ring, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
      } },
      beam: { life: 0.6, draw(ctx, e, k) {
        const r = e.o.r || 10;
        const H = e.o.h || 600;
        const a = Math.sin(Math.PI * k);
        [e, e.o.to || e].forEach((p) => {
          const g = ctx.createLinearGradient(p.x - r * 1.4, 0, p.x + r * 1.4, 0);
          g.addColorStop(0, rgba(e.o.rgb, 0));
          g.addColorStop(0.5, rgba(mixRgb(e.o.rgb, "255,255,255", 0.6), 0.65 * a));
          g.addColorStop(1, rgba(e.o.rgb, 0));
          ctx.fillStyle = g;
          ctx.fillRect(p.x - r * 1.4, 0, r * 2.8, H);
          for (let j = 0; j < 10; j++) {
            const sy = (hash(e.seed + j) * H + k * 400 * (j % 2 ? 1 : -1) + H) % H;
            ctx.fillStyle = rgba("255,255,255", 0.9 * a);
            ctx.fillRect(p.x + (hash(e.seed + j * 3) - 0.5) * r * 2, sy, 2, 2);
          }
        });
      } },
      datashred: { life: 0.6, draw(ctx, e, k) {
        const r = e.o.r || 10;
        const to = e.o.to || e;
        // shredded strips where it left
        for (let i = 0; i < 6; i++) {
          const off = (hash(e.seed + i) - 0.5) * r * 6 * k;
          ctx.fillStyle = rgba(i % 2 ? e.o.rgb : "255,255,255", 1 - k);
          ctx.fillRect(e.x - r + off, e.y - r + i * (r / 3), r * 2, Math.max(1, r / 4));
        }
        // packets streaming along the jump
        for (let j = 0; j < 9; j++) {
          const q = Math.min(1, Math.max(0, k * 1.6 - j * 0.07));
          if (q <= 0 || q >= 1) continue;
          const px = e.x + (to.x - e.x) * q;
          const py = e.y + (to.y - e.y) * q + Math.sin(q * Math.PI * 3 + j) * r * 0.6;
          ctx.fillStyle = rgba(j % 3 ? e.o.rgb : "255,255,255", 0.9);
          ctx.fillRect(px - 3, py - 2, 6, 4);
        }
      } }
    }
  };

  function createFX() {
    const list = [];
    return {
      spawn(slot, id, x, y, o) {
        const def = FX[slot] && FX[slot][id];
        if (!def) return false;
        list.push({ def, x, y, o: Object.assign({ rgb: "255,255,255", r: 10, dir: 1 }, o || {}), age: 0, seed: Math.random() * 1000 });
        if (list.length > 48) list.shift();
        return true;
      },
      draw(ctx, dt) {
        for (let i = list.length - 1; i >= 0; i--) {
          const e = list[i];
          e.age += dt;
          if (e.age >= e.def.life) { list.splice(i, 1); continue; }
          ctx.save();
          try {
            e.def.draw(ctx, e, e.age / e.def.life, e.age);
            if (e.o.gilded) gildFx(ctx, e, e.age / e.def.life, e.age);
          } finally { ctx.restore(); }
        }
      },
      clear() { list.length = 0; },
      get count() { return list.length; }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // v2.0 ADDITIONS
  // ═══════════════════════════════════════════════════════════════════════
  const GOLD = "255,214,120";
  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const textW = (ctx, text) => { const m = ctx.measureText(text); return (m && Number(m.width)) || String(text).length * 7; };

  // A few skins remember a little between frames (where the paddle was, how
  // far a reel has turned). Keyed by colour and column so each paddle on
  // screen, and each Store card, keeps its own.
  const memory = new Map();
  function remember(tag, o, x, init) {
    const k = `${tag}|${o.rgb}|${Math.round(x)}`;
    let m = memory.get(k);
    if (!m) {
      if (memory.size > 40) memory.clear();
      m = init();
      memory.set(k, m);
    }
    return m;
  }

  // A four-point glint, used by the gold trim and anything else that sparkles.
  function twinkle(ctx, x, y, size, alpha, rgb) {
    if (alpha <= 0.01) return;
    ctx.fillStyle = rgba(rgb || GOLD, alpha);
    ctx.fillRect(x - size, y - 0.6, size * 2, 1.2);
    ctx.fillRect(x - 0.6, y - size, 1.2, size * 2);
    ctx.fillStyle = rgba("255,255,255", alpha);
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }

  function hexPath(ctx, cx, cy, r, squashX) {
    const sx = squashX == null ? 1 : squashX;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      const px = cx + Math.cos(a) * r * sx, py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // ═══ Paddle skins, third batch ═══════════════════════════════════════════
  // o also carries hits (returns by this paddle this match) and cracks (points
  // this paddle has conceded this match).

  function paddlePhosphor(ctx, x, y, w, h, o) {
    const ghost = remember("phosphor", o, x, () => ({ y }));
    if (Math.abs(ghost.y - y) > h * 3) ghost.y = y;
    ghost.y += (y - ghost.y) * 0.07;
    const lag = Math.min(1, Math.abs(ghost.y - y) / (h * 0.4));
    ctx.save();
    if (lag > 0.03) {
      // burn-in: the picture the tube was showing a moment ago
      ctx.fillStyle = `rgba(70,255,130,${0.18 * lag})`;
      ctx.fillRect(x, ghost.y, w, h);
      ctx.strokeStyle = `rgba(140,255,170,${0.45 * lag})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, ghost.y + 0.5, w - 1, h - 1);
    }
    ctx.shadowColor = "rgba(70,255,130,0.9)";
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 22;
    ctx.fillStyle = "rgb(5,26,11)";
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    for (let yy = y + 1; yy < y + h; yy += 3) {
      const b = 0.5 + 0.5 * Math.sin(yy * 0.21 + o.t * 5);
      ctx.fillStyle = `rgba(95,255,145,${0.3 + 0.55 * b})`;
      ctx.fillRect(x + 2, yy, w - 4, 2);
    }
    // a block cursor blinking at the bottom of the screen
    if (Math.floor(o.t * 2.5) % 2 === 0) {
      ctx.fillStyle = "rgba(225,255,230,0.95)";
      ctx.fillRect(x + w / 2 - w * 0.22, y + h - 13, w * 0.44, 8);
    }
    ctx.restore();
    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(o.rgb, 1), 2);
    ctx.restore();
  }

  function paddleHexPlating(ctx, x, y, w, h, o) {
    const flash = o.hitFlash || 0;
    const mem = remember("hex", o, x, () => ({ at: 0.5 }));
    if (flash > 0.9 && o.ballY != null) mem.at = clamp01((o.ballY - y) / h);
    const light = mixRgb(o.rgb, "255,255,255", 0.55);
    const dark = mixRgb(o.rgb, "8,12,22", 0.78);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 20;
    ctx.fillStyle = rgba(dark, 1);
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const r = Math.max(4, w * 0.34);
    const rowH = r * 1.5;
    const rows = Math.ceil(h / rowH) + 1;
    const front = (1 - flash) * 1.15;        // how far the flip wave has travelled, 0-1 of the paddle
    for (let row = 0; row < rows; row++) {
      const cy = y + row * rowH;
      const offset = row % 2 ? r * 0.87 : 0;
      for (let col = -1; col < 2; col++) {
        const cx = x + w / 2 + col * r * 1.74 + offset - r * 0.43;
        const dist = Math.abs((cy - y) / h - mem.at);
        const near = flash > 0 ? Math.max(0, 1 - Math.abs(dist - front) / 0.16) : 0;
        const flip = Math.abs(Math.cos(near * Math.PI));          // 1 flat, 0 edge-on
        const idle = 0.5 + 0.5 * Math.sin(o.t * 1.3 + row * 0.9 + col * 2.1);
        hexPath(ctx, cx, cy, r - 1, Math.max(0.12, flip));
        ctx.fillStyle = near > 0.05 ? rgba(light, 0.35 + near * 0.6) : rgba(o.rgb, 0.16 + idle * 0.22);
        ctx.fill();
        ctx.strokeStyle = rgba(light, 0.45 + near * 0.5);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.9), 1.5);
    ctx.restore();
  }

  function paddleCassette(ctx, x, y, w, h, o) {
    const mem = remember("cassette", o, x, () => ({ y, a: 0, t: o.t }));
    const dt = Math.max(0, Math.min(0.05, o.t - mem.t));
    mem.t = o.t;
    const moved = Math.abs(y - mem.y) > h * 2 ? 0 : y - mem.y;
    mem.y = y;
    mem.a += moved * 0.09 + dt * 1.1;        // reels idle slowly and race when the paddle moves
    const light = mixRgb(o.rgb, "255,255,255", 0.6);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.85);
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 20;
    ctx.fillStyle = "rgb(22,22,30)";
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    // the label: a stripe of the team colour with ruled lines
    ctx.fillStyle = rgba(o.rgb, 0.85);
    ctx.fillRect(x + 2, y + 5, w - 4, h * 0.13);
    ctx.fillStyle = "rgba(10,10,16,0.7)";
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 4, y + 8 + i * (h * 0.035), w - 8, 1);
    // tape window between the reels
    ctx.fillStyle = "rgba(120,80,50,0.55)";
    ctx.fillRect(x + w / 2 - 2, y + h * 0.36, 4, h * 0.36);
    const rr = Math.max(4, w * 0.36);
    [0.33, 0.75].forEach((fy, i) => {
      const cx = x + w / 2, cy = y + h * fy;
      ctx.fillStyle = "rgb(8,8,12)";
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(light, 0.9);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
      const a = mem.a * (i ? -1 : 1);
      ctx.strokeStyle = "rgba(240,240,250,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let s = 0; s < 3; s++) {
        const ang = a + s * TAU / 3;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * rr * 0.8, cy + Math.sin(ang) * rr * 0.8);
      }
      ctx.stroke();
      ctx.fillStyle = rgba(o.rgb, 1);
      ctx.beginPath(); ctx.arc(cx, cy, rr * 0.28, 0, TAU); ctx.fill();
    });
    // screw heads
    ctx.fillStyle = "rgba(200,200,215,0.7)";
    [[3, h * 0.24], [w - 5, h * 0.24], [3, h - 7], [w - 5, h - 7]].forEach(([sx, sy]) => ctx.fillRect(x + sx, y + sy, 2, 2));
    strokeFrame(ctx, x, y, w, h, rgba(o.rgb, 0.95), 1.75);
    ctx.restore();
  }

  function paddleBadRom(ctx, x, y, w, h, o) {
    const seed = (o.hits || 0) * 13.7;
    const flash = o.hitFlash || 0;
    const palette = [o.rgb, "255,60,200", "250,250,255", "70,235,120", "255,190,60"];
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.85);
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 20;
    ctx.fillStyle = "rgb(10,6,20)";
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const cell = 4;
    const cols = Math.ceil(w / cell);
    const tile = 8 * cell;                     // garbage comes in 8-pixel-high sprite tiles
    for (let cy = 0; cy < h; cy += cell) {
      const tileIndex = Math.floor(cy / tile);
      const kind = hash(tileIndex * 5.3 + seed);            // each tile is one kind of garbage
      const inTile = Math.floor((cy % tile) / cell);
      for (let cx = 0; cx < cols; cx++) {
        let v;
        if (kind < 0.3) v = hash(cx * 3.1 + inTile * 7.7 + tileIndex * 1.9 + seed);          // noise
        else if (kind < 0.6) v = hash((cx % 2) * 3.1 + inTile * 2.3 + tileIndex + seed);      // stripes
        else if (kind < 0.85) v = hash(Math.abs(cx - cols / 2 + 0.5) * 4.1 + inTile * 5.9 + tileIndex * 3.3 + seed);  // mirrored, like a sprite
        else v = hash(tileIndex * 9.9 + seed) * 0.5 + 0.5;                                     // one solid colour
        if (v < 0.34) continue;
        const col = palette[Math.floor(v * 97) % palette.length];
        ctx.fillStyle = rgba(col, 0.55 + v * 0.45);
        ctx.fillRect(x + cx * cell, y + cy, cell, cell);
      }
    }
    // one row always tears sideways, as if the tile map were off by a byte
    const tear = y + (hash(seed + 2.2) * (h - 8));
    ctx.fillStyle = rgba("255,255,255", 0.35 + flash * 0.5);
    ctx.fillRect(x - 3, tear, w + 6, 2);
    if (flash > 0) { ctx.fillStyle = rgba("255,255,255", flash * 0.4); ctx.fillRect(x, y, w, h); }
    ctx.restore();
    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(o.rgb, 0.95), 1.75);
    ctx.restore();
  }

  function paddleCrackedScreen(ctx, x, y, w, h, o) {
    const cracks = Math.max(0, Math.min(8, Math.floor(o.cracks || 0)));
    const light = mixRgb(o.rgb, "255,255,255", 0.5);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 22;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, rgba(mixRgb(o.rgb, "0,0,0", 0.35), 1));
    g.addColorStop(0.5, rgba(o.rgb, 1));
    g.addColorStop(1, rgba(mixRgb(o.rgb, "0,0,0", 0.55), 1));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    // glass glare
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.08); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.1); ctx.lineTo(x, y + h * 0.22);
    ctx.closePath(); ctx.fill();
    ctx.lineJoin = "round";
    for (let c = 0; c < cracks; c++) {
      const ix = x + w * (0.2 + hash(c * 3.7) * 0.6);
      const iy = y + h * (0.1 + hash(c * 5.1 + 1) * 0.8);
      // a dead patch where the glass took the hit
      ctx.fillStyle = "rgba(4,6,12,0.75)";
      ctx.beginPath(); ctx.arc(ix, iy, 2.2, 0, TAU); ctx.fill();
      const branches = 4 + Math.floor(hash(c * 9.3) * 3);
      for (let b = 0; b < branches; b++) {
        let px = ix, py = iy;
        let ang = hash(c * 2.1 + b * 4.3) * TAU;
        ctx.beginPath();
        ctx.moveTo(px, py);
        const steps = 3 + Math.floor(hash(c + b * 1.7) * 3);
        for (let s = 0; s < steps; s++) {
          ang += (hash(c * 7.7 + b * 3.3 + s) - 0.5) * 1.1;
          const len = 5 + hash(c * 1.3 + b + s * 2.9) * 13;
          px += Math.cos(ang) * len * 0.55;      // the paddle is tall and thin, so cracks run mostly up and down
          py += Math.sin(ang) * len * 1.25;
          ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
    // past five hits the picture starts to fail in bands
    if (cracks >= 5) {
      const tick = Math.floor(o.t * 12);
      for (let i = 0; i < cracks - 3; i++) {
        const by = y + hash(tick * 0.31 + i * 4.4) * h;
        ctx.fillStyle = i % 2 ? "rgba(0,0,0,0.5)" : rgba("255,255,255", 0.3);
        ctx.fillRect(x, by, w, 2 + hash(i + tick) * 5);
      }
    }
    ctx.restore();
    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.9), 1.5);
    ctx.restore();
  }

  function paddleBrickwork(ctx, x, y, w, h, o) {
    const hits = o.hits || 0;
    const flash = o.hitFlash || 0;
    const wear = Math.min(0.7, hits * 0.02);
    const light = mixRgb(o.rgb, "255,255,255", 0.45);
    const shade = mixRgb(o.rgb, "0,0,0", 0.4);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.85);
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 20;
    ctx.fillStyle = "rgb(12,10,18)";             // the mortar
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const bh = 8;
    const bw = w / 2;
    let n = 0;
    for (let row = 0, by = y; by < y + h; row++, by += bh) {
      const shift = row % 2 ? -bw / 2 : 0;
      for (let bx = x + shift; bx < x + w; bx += bw, n++) {
        const roll = hash(n * 6.1 + 0.7);
        const gone = roll < wear * 0.35;                       // knocked clean out
        const chipped = !gone && roll < wear;
        if (gone) continue;
        const tone = hash(n * 2.3);
        ctx.fillStyle = rgba(tone > 0.66 ? light : tone > 0.33 ? o.rgb : shade, 0.92);
        ctx.fillRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.fillRect(bx + 0.5, by + 0.5, bw - 1, 1.5);
        if (chipped) {
          // a corner broken off
          ctx.fillStyle = "rgb(12,10,18)";
          const cw = 2 + hash(n * 1.9) * (bw * 0.45);
          ctx.beginPath();
          if (hash(n * 4.4) > 0.5) { ctx.moveTo(bx + bw, by); ctx.lineTo(bx + bw - cw, by); ctx.lineTo(bx + bw, by + bh * 0.75); }
          else { ctx.moveTo(bx, by + bh); ctx.lineTo(bx + cw, by + bh); ctx.lineTo(bx, by + bh * 0.25); }
          ctx.closePath(); ctx.fill();
        }
      }
    }
    if (flash > 0) { ctx.fillStyle = rgba("255,255,255", flash * 0.3); ctx.fillRect(x, y, w, h); }
    ctx.restore();
    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.9), 1.5);
    ctx.restore();
  }

  function paddleShopkeeper(ctx, x, y, w, h, o) {
    const cx = x + w / 2;
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 12 : 24;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "#565a6e");
    g.addColorStop(0.3, "#e6e9f5");
    g.addColorStop(0.55, "#9da2b8");
    g.addColorStop(0.8, "#d4d8ea");
    g.addColorStop(1, "#4a4e60");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    // visor: two LED eyes that follow the ball and blink
    const vy = y + h * 0.1, vh = Math.max(10, h * 0.13);
    ctx.fillStyle = "rgb(10,8,20)";
    ctx.fillRect(x + 2, vy, w - 4, vh);
    const look = Math.max(-1, Math.min(1, ((o.ballY == null ? y + h / 2 : o.ballY) - (vy + vh / 2)) / (h * 1.2)));
    const blink = (o.t % 3.7) < 0.12;
    ctx.fillStyle = "rgba(255,190,60,0.98)";
    const eh = blink ? 1.5 : Math.max(3, vh * 0.42);
    const ew = Math.max(2.5, w * 0.2);
    [-1, 1].forEach(s => ctx.fillRect(cx + s * w * 0.22 - ew / 2, vy + vh / 2 - eh / 2 + look * vh * 0.22, ew, eh));
    // speaker grille
    ctx.fillStyle = "rgba(20,20,34,0.75)";
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 4, y + h * 0.3 + i * 4, w - 8, 1.5);
    // chest ticker: coins counting up
    const ty = y + h * 0.5, th = h * 0.3;
    ctx.fillStyle = "rgb(14,10,26)";
    ctx.fillRect(x + 3, ty, w - 6, th);
    ctx.save();
    ctx.beginPath(); ctx.rect(x + 3, ty, w - 6, th); ctx.clip();
    for (let i = 0; i < 7; i++) {
      const py = ty + ((o.t * 16 + i * (th / 5)) % (th + 8)) - 4;
      ctx.fillStyle = i % 3 === 0 ? "rgba(255,214,120,0.95)" : rgba(o.rgb, 0.8);
      ctx.beginPath(); ctx.arc(cx + (i % 2 ? 1 : -1) * w * 0.12, py, Math.max(1.5, w * 0.11), 0, TAU); ctx.fill();
    }
    ctx.restore();
    // rivets and the team-colour bezel
    ctx.fillStyle = "rgba(60,62,80,0.9)";
    [[3, 3], [w - 5, 3], [3, h - 5], [w - 5, h - 5]].forEach(([rx, ry]) => ctx.fillRect(x + rx, y + ry, 2, 2));
    strokeFrame(ctx, x, y, w, h, rgba(o.rgb, 1), 2.25);
    ctx.restore();
  }

  Object.assign(PADDLE_RENDERERS, {
    phosphor: paddlePhosphor,
    hexplating: paddleHexPlating,
    cassette: paddleCassette,
    badrom: paddleBadRom,
    crackedscreen: paddleCrackedScreen,
    brickwork: paddleBrickwork,
    shopkeeper: paddleShopkeeper
  });

  // ═══ Ball trails, third batch ════════════════════════════════════════════
  // o also carries speed (pixels per frame) and rally (hits in this rally).

  function trailOscilloscope(ctx, trail, o) {
    const rgb = o.rgb || "140,255,170";
    const pts = resample(trail, 3);
    if (pts.length < 2) return;
    const amp = o.r * (0.35 + Math.min(1.5, (o.speed == null ? 6 : o.speed) / 9));
    const phase = (o.t || 0) * 16;
    ctx.save();
    ctx.lineJoin = "round";
    // the flat baseline the beam would draw with no signal
    ctx.strokeStyle = rgba(rgb, 0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const wa = Math.sin(a.d * 0.32 - phase) * amp * (0.25 + a.f * 0.75);
      const wb = Math.sin(b.d * 0.32 - phase) * amp * (0.25 + b.f * 0.75);
      ctx.strokeStyle = rgba(b.f > 0.75 ? mixRgb(rgb, "255,255,255", 0.6) : rgb, 0.12 + 0.85 * b.f);
      ctx.lineWidth = 1 + b.f * 1.6;
      ctx.beginPath();
      ctx.moveTo(a.x + nx * wa, a.y + ny * wa);
      ctx.lineTo(b.x + nx * wb, b.y + ny * wb);
      ctx.stroke();
    }
    ctx.restore();
  }

  function trailSnake(ctx, trail, o) {
    const rgb = o.rgb || "120,235,130";
    const dark = mixRgb(rgb, "0,0,0", 0.4);
    const spacing = Math.max(8, o.r * 1.45);
    const pts = resample(trail, spacing);
    const segments = Math.min(pts.length, 3 + Math.floor(Math.min(24, o.rally || 0) * 0.75));
    ctx.save();
    for (let i = segments - 1; i >= 0; i--) {
      const p = pts[i];
      const k = 1 - i / Math.max(1, segments);
      const size = o.r * (1.0 + 0.45 * k);
      ctx.fillStyle = rgba(i % 2 ? dark : rgb, 0.35 + 0.6 * k);
      ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
      ctx.strokeStyle = rgba("0,0,0", 0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(p.x - size / 2) + 0.5, Math.round(p.y - size / 2) + 0.5, size - 1, size - 1);
    }
    ctx.restore();
  }

  function trailHexPath(ctx, trail, o) {
    const rgb = o.rgb || "90,240,255";
    const s = Math.max(9, o.r * 1.5);           // hex radius; tiles sit on a fixed grid in the floor
    const colW = s * 1.732, rowH = s * 1.5;
    const seen = new Set();
    ctx.save();
    ctx.lineWidth = 1.25;
    const n = trail.length;
    for (let i = 0; i < n; i++) {
      const p = trail[i];
      const row = Math.round(p.y / rowH);
      const col = Math.round((p.x - (row % 2 ? colW / 2 : 0)) / colW);
      const k = `${col},${row}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const f = 1 - i / n;
      const cx = col * colW + (row % 2 ? colW / 2 : 0), cy = row * rowH;
      hexPath(ctx, cx, cy, s - 1.5);
      ctx.fillStyle = rgba(rgb, 0.05 + 0.3 * f * f);
      ctx.fill();
      ctx.strokeStyle = rgba(f > 0.7 ? mixRgb(rgb, "255,255,255", 0.6) : rgb, 0.12 + 0.75 * f);
      ctx.stroke();
    }
    ctx.restore();
  }

  function trailTapeRibbon(ctx, trail, o) {
    const pts = resample(trail, 3);
    if (pts.length < 3) return;
    const rgb = o.rgb || "255,255,255";
    const phase = (o.t || 0) * 9;
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      // the ribbon twists as it flutters, so its visible width swings from full to edge-on
      const twist = Math.cos(p.d * 0.11 - phase);
      const half = o.r * 0.62 * Math.abs(twist) + 0.7;
      const flutter = Math.sin(p.d * 0.07 - phase * 0.6) * o.r * 0.7 * (1 - p.f);
      const cx = p.x - dy * flutter, cy = p.y + dx * flutter;
      left.push({ x: cx - dy * half, y: cy + dx * half });
      right.push({ x: cx + dy * half, y: cy - dx * half });
    }
    ctx.save();
    const head = pts[0], tail = pts[pts.length - 1];
    const g = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    g.addColorStop(0, "rgba(128,84,52,0.95)");
    g.addColorStop(0.6, "rgba(70,44,28,0.7)");
    g.addColorStop(1, "rgba(40,26,18,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fill();
    // the glossy edge catches the owner's colour
    const edge = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    edge.addColorStop(0, rgba(mixRgb(rgb, "255,255,255", 0.5), 0.9));
    edge.addColorStop(1, rgba(rgb, 0));
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
    ctx.stroke();
    ctx.restore();
  }

  function trailWetPaint(ctx, trail, o) {
    const rgb = o.rgb || "245,245,255";
    const light = mixRgb(rgb, "255,255,255", 0.45);
    const pts = resample(trail, 4);
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    for (let i = pts.length - 1; i >= 1; i--) {
      const a = pts[i - 1], b = pts[i];
      ctx.strokeStyle = rgba(rgb, 0.1 + 0.62 * b.f);
      ctx.lineWidth = o.r * 1.5 * (0.55 + 0.45 * b.f);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // a wet highlight down the middle of the fresh end
    ctx.strokeStyle = rgba(light, 0.55);
    ctx.lineWidth = Math.max(1, o.r * 0.28);
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 0; i < Math.min(pts.length, 6); i++) ctx.lineTo(pts[i].x, pts[i].y - o.r * 0.3);
    ctx.stroke();
    // drips run down from the older paint
    for (let i = 2; i < pts.length; i += 2) {
      const p = pts[i];
      const seed = Math.round(p.x / 14) * 1.7 + Math.round(p.y / 14) * 0.9;
      if (hash(seed) < 0.55) continue;
      const len = (1 - p.f) * o.r * (1.2 + hash(seed + 3) * 2.2);
      ctx.fillStyle = rgba(rgb, 0.12 + 0.5 * p.f);
      ctx.fillRect(p.x - 1.25, p.y, 2.5, len);
      ctx.beginPath(); ctx.arc(p.x, p.y + len, 1.9, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  Object.assign(TRAIL_RENDERERS, {
    oscilloscope: trailOscilloscope,
    snake: trailSnake,
    hexpath: trailHexPath,
    taperibbon: trailTapeRibbon,
    wetpaint: trailWetPaint
  });

  // ═══ Ball skins, second batch ════════════════════════════════════════════
  // o also carries heat (0-1), face (a counter that changes on every hit) and
  // final (true while the match-winning point plays out).

  function ballToken(ctx, x, y, r, o) {
    const turn = Math.cos((o.t || 0) * 5.2);
    const rx = Math.max(r * 0.14, Math.abs(turn) * r);
    glow(ctx, o);
    const g = ctx.createLinearGradient(x - rx, y - r, x + rx, y + r);
    g.addColorStop(0, "#fff0b8");
    g.addColorStop(0.45, "#f0c24a");
    g.addColorStop(1, "#9a6a14");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, rx, r, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // the owner's colour runs round the rim so the ball still says whose it is
    ctx.strokeStyle = rgba(o.rgb, 1);
    ctx.lineWidth = Math.max(1.5, r * 0.2);
    ctx.beginPath(); ctx.ellipse(x, y, rx, r, 0, 0, TAU); ctx.stroke();
    if (rx > r * 0.5) {
      ctx.strokeStyle = "rgba(122,84,16,0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, rx * 0.62, r * 0.62, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = "rgba(110,74,12,0.9)";
      ctx.fillRect(x - rx * 0.12, y - r * 0.4, rx * 0.24, r * 0.8);
    }
    // a glint slides across the edge as the coin turns
    const gl = 1 - Math.abs(turn);
    if (gl > 0.6) twinkle(ctx, x + rx * 0.2, y - r * 0.55, r * 0.5 * gl, (gl - 0.6) * 2.4, "255,255,255");
  }

  function ballSingularity(ctx, x, y, r, o) {
    const t = o.t || 0;
    const light = mixRgb(o.rgb, "255,255,255", 0.6);
    // the far half of the disk goes behind the hole
    ctx.strokeStyle = rgba(o.rgb, 0.55);
    ctx.lineWidth = Math.max(1.5, r * 0.22);
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r * 0.42, -0.35, Math.PI, TAU); ctx.stroke();
    glow(ctx, o);
    ctx.fillStyle = rgba(o.rgb, 0.9);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgb(0,0,0)";
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.fill();
    // photon ring
    ctx.strokeStyle = rgba(light, 0.95);
    ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.arc(x, y, r * 0.84, 0, TAU); ctx.stroke();
    // the near half of the disk crosses in front
    ctx.strokeStyle = rgba(light, 0.95);
    ctx.lineWidth = Math.max(1.5, r * 0.24);
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r * 0.42, -0.35, 0, Math.PI); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = t * (3 + i) + i * 2.1;
      ctx.fillStyle = rgba("255,255,255", 0.85);
      ctx.fillRect(x + Math.cos(a) * r * 1.5 * Math.cos(0.35) - 1, y + Math.sin(a) * r * 0.42 - Math.cos(a) * r * 0.5 - 1, 2, 2);
    }
  }

  function ballDiscoBall(ctx, x, y, r, o) {
    const t = o.t || 0;
    // flecks of light thrown onto the floor around it
    for (let i = 0; i < 6; i++) {
      const a = t * 1.6 + i * TAU / 6;
      const d = r * (2.1 + 0.5 * Math.sin(t * 2.3 + i));
      const al = 0.35 + 0.35 * Math.sin(t * 5 + i * 1.7);
      ctx.fillStyle = rgba(i % 2 ? o.rgb : "255,255,255", al);
      ctx.save();
      ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
      ctx.rotate(a);
      ctx.fillRect(-2.5, -1.5, 5, 3);
      ctx.restore();
    }
    glow(ctx, o);
    ctx.fillStyle = rgba(mixRgb(o.rgb, "30,34,48", 0.6), 1);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    const rows = 5, cols = 6;
    const shift = (t * 1.4) % 1;
    for (let row = 0; row < rows; row++) {
      const lat = -1 + (row + 0.5) * (2 / rows);
      const ry = y + lat * r;
      const half = Math.sqrt(Math.max(0, 1 - lat * lat)) * r;
      for (let col = -1; col < cols; col++) {
        const u0 = -1 + (col + shift) * (2 / cols), u1 = u0 + 2 / cols;
        const x0 = x + Math.sin(Math.max(-1, Math.min(1, u0)) * Math.PI / 2) * half;
        const x1 = x + Math.sin(Math.max(-1, Math.min(1, u1)) * Math.PI / 2) * half;
        const sparkle = hash(row * 7.1 + ((col + Math.floor(t * 1.4)) % 97) * 3.3 + Math.floor(t * 6) * 0.61);
        ctx.fillStyle = sparkle > 0.78 ? "rgba(255,255,255,0.98)" : rgba(mixRgb(o.rgb, "210,220,240", 0.45 + sparkle * 0.4), 0.55 + sparkle * 0.4);
        ctx.fillRect(x0 + 0.5, ry - r / rows + 0.5, Math.max(0.5, x1 - x0 - 1), (2 * r) / rows - 1);
      }
    }
    ctx.restore();
    ctx.strokeStyle = rgba(o.rgb, 0.95);
    ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }

  const spinState = { a: 0, t: 0 };
  function ballSpinner(ctx, x, y, r, o) {
    const t = o.t || 0;
    const speed = Math.hypot(o.vx || 0, o.vy || 0);
    const dt = Math.max(0, Math.min(0.05, t - spinState.t));
    spinState.t = t;
    spinState.a += dt * (3.5 + speed * 0.85);
    glow(ctx, o);
    ctx.fillStyle = rgba(mixRgb(o.rgb, "0,0,0", 0.72), 0.9);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    const n = 8;
    const head = Math.floor(spinState.a) % n;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n - Math.PI / 2;
      const behind = (head - i + n) % n;
      const al = Math.max(0.12, 1 - behind / (n - 1));
      ctx.strokeStyle = behind === 0 ? "rgba(255,255,255,1)" : rgba(o.rgb, al);
      ctx.lineWidth = Math.max(1.5, r * 0.22);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42);
      ctx.lineTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86);
      ctx.stroke();
    }
  }

  function ballD20(ctx, x, y, r, o) {
    const face = o.final ? 20 : 1 + Math.floor(hash((o.face || 0) * 7.3 + 1.1) * 20);
    const R = r * 1.15;
    const light = mixRgb(o.rgb, "255,255,255", 0.6);
    const dark = mixRgb(o.rgb, "0,0,0", 0.55);
    glow(ctx, o);
    hexPath(ctx, x, y, R);
    ctx.fillStyle = rgba(dark, 1);
    ctx.fill();
    ctx.shadowBlur = 0;
    // the front face of the die and the edges fanning out behind it
    const tri = [0, 1, 2].map(i => ({ x: x + Math.cos(-Math.PI / 2 + i * TAU / 3) * R * 0.72, y: y + Math.sin(-Math.PI / 2 + i * TAU / 3) * R * 0.72 }));
    ctx.fillStyle = o.final ? "rgba(255,214,120,0.98)" : rgba(o.rgb, 0.95);
    ctx.beginPath(); ctx.moveTo(tri[0].x, tri[0].y); ctx.lineTo(tri[1].x, tri[1].y); ctx.lineTo(tri[2].x, tri[2].y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(light, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      const corner = tri[[1, 1, 2, 2, 0, 0][i]];
      ctx.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      ctx.lineTo(corner.x, corner.y);
    }
    ctx.stroke();
    hexPath(ctx, x, y, R);
    ctx.stroke();
    ctx.fillStyle = o.final ? "rgb(40,24,0)" : "rgb(6,8,14)";
    ctx.font = `bold ${Math.max(6, Math.round(r * (face > 9 ? 0.72 : 0.86)))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(face), x, y + r * 0.1);
  }

  function ballErrorIcon(ctx, x, y, r, o) {
    const heat = clamp01(o.heat || 0);
    const t = o.t || 0;
    const alarm = heat > 0.2 && Math.sin(t * (5 + heat * 22)) > 0.25;
    const R = r * 1.3;
    const pts = [0, 1, 2].map(i => ({ x: x + Math.cos(-Math.PI / 2 + i * TAU / 3) * R, y: y + r * 0.18 + Math.sin(-Math.PI / 2 + i * TAU / 3) * R }));
    glow(ctx, o);
    ctx.lineJoin = "round";
    ctx.fillStyle = alarm ? "rgb(255,70,70)" : o.hex;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.lineTo(pts[2].x, pts[2].y); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = alarm ? "rgba(255,255,255,0.95)" : rgba(mixRgb(o.rgb, "255,255,255", 0.6), 0.95);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = alarm ? "rgb(255,255,255)" : "rgb(8,8,14)";
    ctx.fillRect(x - r * 0.12, y - r * 0.38, r * 0.24, r * 0.62);
    ctx.fillRect(x - r * 0.12, y + r * 0.38, r * 0.24, r * 0.24);
  }

  Object.assign(BALL_RENDERERS, {
    token: ballToken, singularity: ballSingularity, discoball: ballDiscoBall,
    spinner: ballSpinner, d20: ballD20, erroricon: ballErrorIcon
  });

  // ═══ Dash effects, second batch ══════════════════════════════════════════

  function dashFar(trail, o) {
    return trail.reduce((a, tr) => (Math.abs(tr.y - o.curY) > Math.abs(a.y - o.curY) ? tr : a), trail[0]);
  }

  function dashLightWall(ctx, trail, o) {
    const k = dashLife(trail);
    const far = dashFar(trail, o);
    const top = Math.min(far.y, o.curY), bottom = Math.max(far.y, o.curY) + o.h;
    const light = mixRgb(o.rgb, "255,255,255", 0.65);
    ctx.shadowColor = rgba(o.rgb, 0.9 * k);
    ctx.shadowBlur = 18;
    ctx.fillStyle = rgba(o.rgb, 0.5 * k);
    ctx.fillRect(far.x + 2, top, o.w - 4, bottom - top);
    ctx.shadowBlur = 0;
    // hard bright edges, like a pane of light
    ctx.fillStyle = rgba(light, 0.95 * k);
    ctx.fillRect(far.x + 2, top, 1.5, bottom - top);
    ctx.fillRect(far.x + o.w - 3.5, top, 1.5, bottom - top);
    ctx.fillStyle = rgba("255,255,255", 0.3 * k);
    for (let yy = top + 6; yy < bottom; yy += 12) ctx.fillRect(far.x + 2, yy, o.w - 4, 1);
  }

  function dashRubberBand(ctx, trail, o) {
    const k = dashLife(trail);
    const far = dashFar(trail, o);
    // the far end snaps back toward the paddle as the effect runs out
    const farY = o.curY + (far.y - o.curY) * k;
    const top = Math.min(farY, o.curY), bottom = Math.max(farY, o.curY) + o.h;
    const mid = (top + bottom) / 2;
    const waist = o.w * (0.18 + 0.5 * (1 - k));
    const x0 = far.x, x1 = far.x + o.w, cx = far.x + o.w / 2;
    ctx.fillStyle = rgba(o.rgb, 0.2 + 0.55 * k);
    ctx.shadowColor = rgba(o.rgb, 0.8 * k);
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x1, top);
    ctx.quadraticCurveTo(cx + waist / 2, mid, x1, bottom);
    ctx.lineTo(x0, bottom);
    ctx.quadraticCurveTo(cx - waist / 2, mid, x0, top);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(mixRgb(o.rgb, "255,255,255", 0.6), 0.8 * k);
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }

  function dashFrameSkip(ctx, trail, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.55);
    trail.forEach((tr) => {
      // three hard steps of brightness and nothing in between
      const a = tr.life > 10 ? 0.85 : tr.life > 5 ? 0.55 : 0.28;
      ctx.fillStyle = rgba(o.rgb, a);
      ctx.fillRect(tr.x, tr.y, o.w, o.h);
      ctx.strokeStyle = rgba(light, a);
      ctx.lineWidth = 1;
      ctx.strokeRect(tr.x + 0.5, tr.y + 0.5, o.w - 1, o.h - 1);
      // a dropped scanline through each copy
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(tr.x, tr.y + o.h * (0.2 + hash(tr.y * 0.37) * 0.6), o.w, 2);
    });
  }

  Object.assign(DASH_RENDERERS, { lightwall: dashLightWall, rubberband: dashRubberBand, frameskip: dashFrameSkip });

  // ═══ One-shot effects, second batch ══════════════════════════════════════
  //   hit:     e.o.rally = hits in the rally so far
  //   victory: x,y = centre of the winner's paddle, e.o.rgb2 = the loser's
  //            colour, e.o.ph = paddle height, e.o.dir points into the court

  function drawCoin(ctx, x, y, r, spin, alpha) {
    const rx = Math.max(1, Math.abs(Math.cos(spin)) * r);
    ctx.fillStyle = `rgba(240,194,74,${alpha})`;
    ctx.beginPath(); ctx.ellipse(x, y, rx, r, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,240,184,${alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (rx > r * 0.55) { ctx.fillStyle = `rgba(122,84,16,${alpha})`; ctx.fillRect(x - 0.75, y - r * 0.45, 1.5, r * 0.9); }
  }

  Object.assign(FX.hit, {
    rallycounter: { life: 0.75, draw(ctx, e, k, age) {
      const n = Math.max(1, Math.floor(e.o.rally || 1));
      const pop = k < 0.18 ? k / 0.18 : 1;
      const size = (15 + Math.min(34, n) * 1.15) * (0.55 + 0.45 * ease(pop));
      const dir = e.o.dir || 1;
      const px = e.x + dir * (22 + age * 46);
      const py = e.y - 12 - age * 54;
      ctx.font = `bold ${Math.round(size)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = rgba(e.o.rgb, 0.9);
      ctx.shadowBlur = 12;
      ctx.fillStyle = rgba(n >= 20 ? GOLD : n >= 10 ? mixRgb(e.o.rgb, "255,255,255", 0.6) : e.o.rgb, 1 - k * k);
      ctx.fillText(String(n), px, py);
      ctx.shadowBlur = 0;
      ctx.font = "bold 9px monospace";
      ctx.fillStyle = rgba("255,255,255", 0.75 * (1 - k));
      ctx.fillText(n >= 10 ? "RALLY" : "HIT", px, py + size * 0.62);
    } },
    equalizer: { life: 0.55, draw(ctx, e, k) {
      const dir = e.o.dir || 1;
      const r = e.o.r || 10;
      const env = Math.sin(Math.PI * Math.min(1, k * 1.15));
      const tick = Math.floor(k * 9);
      for (let j = 0; j < 7; j++) {
        const lvl = hash(e.seed + j * 3.7 + tick * 1.9);
        const bars = Math.max(1, Math.round((1 + lvl * 6) * env * (1 - j * 0.08)));
        const bx = e.x + dir * (8 + j * 8) - 3;
        for (let b = 0; b < bars; b++) {
          const top = b >= 5;
          ctx.fillStyle = top ? rgba("255,255,255", 0.95 * (1 - k * 0.5)) : rgba(b >= 3 ? mixRgb(e.o.rgb, "255,255,255", 0.45) : e.o.rgb, 0.9 * (1 - k * 0.5));
          ctx.fillRect(bx, e.y - 2 - b * 5, 6, 4);
          ctx.fillStyle = rgba(e.o.rgb, 0.22 * (1 - k));
          ctx.fillRect(bx, e.y + 3 + b * 5, 6, 4);          // reflection
        }
      }
      ctx.strokeStyle = rgba(e.o.rgb, 0.4 * (1 - k));
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(e.x, e.y + 2.5); ctx.lineTo(e.x + dir * (r + 62), e.y + 2.5); ctx.stroke();
    } },
    coinspray: { life: 0.95, draw(ctx, e, k, age) {
      const dir = e.o.dir || 1;
      const floor = 64, g = 760;
      for (let j = 0; j < 6; j++) {
        const s = e.seed + j * 5.9;
        const vx = dir * (50 + hash(s) * 150);
        const vy0 = -(150 + hash(s + 1) * 170);
        // one bounce off an imaginary floor below the contact point
        const tHit = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * g * floor)) / g;
        let py;
        if (age < tHit) py = vy0 * age + 0.5 * g * age * age;
        else {
          const t2 = age - tHit;
          py = Math.min(floor, floor - (vy0 + g * tHit) * 0.42 * t2 + 0.5 * g * t2 * t2);
        }
        drawCoin(ctx, e.x + vx * age, e.y + py, 4.5, age * 16 + j * 1.3, 1 - k * k);
      }
    } }
  });

  Object.assign(FX.score, {
    fatalerror: { life: 0.6, draw(ctx, e, k) {
      const W = e.o.w || 1000, H = e.o.h || 600;
      // the half of the court that just let the ball through
      const x0 = e.x < W / 2 ? 0 : W / 2;
      const a = k < 0.08 ? k / 0.08 : k > 0.85 ? (1 - k) / 0.15 : 1;
      ctx.fillStyle = `rgba(18,60,190,${0.86 * a})`;
      ctx.fillRect(x0, 0, W / 2, H);
      const fs = Math.max(9, Math.round(H * 0.034));
      const left = x0 + W * 0.045;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = rgba("255,255,255", a);
      ctx.font = `bold ${fs * 3}px monospace`;
      ctx.fillText(":(", left, H * 0.16);
      ctx.font = `bold ${fs}px monospace`;
      const lines = ["FATAL ERROR", "POINT_NOT_DEFENDED", `STOP 0x${Math.floor(e.seed * 4096).toString(16).toUpperCase().padStart(6, "0")}`, "", "COLLECTING YOUR PRIDE... 100%"];
      lines.forEach((line, i) => ctx.fillText(line, left, H * 0.16 + fs * 4 + i * fs * 1.5, W / 2 - W * 0.09));
      if (Math.floor(k * 10) % 2 === 0) ctx.fillRect(left, H * 0.16 + fs * 4 + lines.length * fs * 1.5, fs * 0.6, fs);
      ctx.fillStyle = rgba(e.o.rgb, 0.9 * a);
      ctx.fillRect(x0, 0, W / 2, 3);
      ctx.fillRect(x0, H - 3, W / 2, 3);
    } },
    jackpot: { life: 1.6, draw(ctx, e, k, age) {
      const W = e.o.w || 1000, H = e.o.h || 600;
      const dir = e.o.dir || 1;
      const cell = Math.max(16, Math.min(40, H * 0.085));
      const bx = e.x + dir * (cell * 2.6), by = Math.max(cell * 1.4, Math.min(H - cell * 2.4, e.y - cell * 1.6));
      const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
      const symbols = "$#%&@7";
      // the machine
      ctx.fillStyle = `rgba(20,10,30,${0.9 * fade})`;
      ctx.fillRect(bx - cell * 1.7, by - cell * 0.7, cell * 3.4, cell * 1.4);
      ctx.strokeStyle = rgba(GOLD, fade);
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - cell * 1.7, by - cell * 0.7, cell * 3.4, cell * 1.4);
      ctx.font = `bold ${Math.round(cell * 0.8)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let rI = 0; rI < 3; rI++) {
        const stop = 0.3 + rI * 0.22;                       // reels lock left to right
        const locked = age >= stop;
        const sym = locked ? "7" : symbols[Math.floor(hash(e.seed + rI * 9 + Math.floor(age * 30)) * symbols.length)];
        const rx = bx + (rI - 1) * cell * 1.05;
        ctx.fillStyle = `rgba(245,245,255,${0.95 * fade})`;
        ctx.fillRect(rx - cell * 0.45, by - cell * 0.5, cell * 0.9, cell);
        ctx.fillStyle = locked ? `rgba(220,30,60,${fade})` : `rgba(40,40,60,${fade})`;
        ctx.fillText(sym, rx, by + cell * 0.04);
      }
      if (age > 0.76) {
        const b = age - 0.76;
        if (Math.floor(b * 8) % 2 === 0) {
          ctx.fillStyle = rgba(GOLD, fade);
          ctx.font = `bold ${Math.round(cell * 0.5)}px monospace`;
          ctx.fillText("JACKPOT", bx, by - cell * 1.05);
        }
        // the payout pours out of the goal
        for (let j = 0; j < 26; j++) {
          const s = e.seed + j * 4.3;
          const delay = hash(s) * 0.35;
          const a = b - delay;
          if (a <= 0) continue;
          const vx = dir * (60 + hash(s + 1) * 260);
          const vy = -(60 + hash(s + 2) * 260);
          drawCoin(ctx, e.x + vx * a, e.y + vy * a + 420 * a * a, 5, a * 15 + j, fade);
        }
      }
    } },
    eyeopens: { life: 1.35, draw(ctx, e, k) {
      const H = e.o.h || 600;
      const dir = e.o.dir || 1;
      const eh = H * 0.3;                      // the eye stands tall in the goal mouth
      const cy = Math.max(eh * 0.7, Math.min(H - eh * 0.7, e.y));
      const cx = e.x + dir * eh * 0.3;
      let open = Math.min(1, k * 5);
      if (k > 0.5 && k < 0.68) open *= Math.abs((k - 0.59) / 0.09);        // one blink
      if (k > 0.86) open *= (1 - k) / 0.14;
      open = Math.max(0.03, open);
      const half = eh * 0.34 * open;           // how wide the lids are apart
      ctx.shadowColor = rgba(e.o.rgb, 0.9);
      ctx.shadowBlur = 24;
      ctx.fillStyle = "rgba(255,240,240,0.96)";
      ctx.beginPath();
      ctx.moveTo(cx, cy - eh / 2);
      ctx.quadraticCurveTo(cx + half * 2, cy, cx, cy + eh / 2);
      ctx.quadraticCurveTo(cx - half * 2, cy, cx, cy - eh / 2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.clip();
      // the iris looks into the court, at whoever is left standing
      const ix = cx + dir * half * 0.35;
      ctx.fillStyle = rgba(e.o.rgb, 1);
      ctx.beginPath(); ctx.arc(ix, cy, eh * 0.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12;
        ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * eh * 0.09, cy + Math.sin(a) * eh * 0.09); ctx.lineTo(ix + Math.cos(a) * eh * 0.2, cy + Math.sin(a) * eh * 0.2); ctx.stroke();
      }
      ctx.fillStyle = "rgb(8,0,4)";
      ctx.beginPath(); ctx.ellipse(ix, cy, eh * 0.05, eh * 0.11, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath(); ctx.arc(ix - eh * 0.06, cy - eh * 0.07, eh * 0.025, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = rgba(e.o.rgb, 0.95);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - eh / 2);
      ctx.quadraticCurveTo(cx + half * 2, cy, cx, cy + eh / 2);
      ctx.quadraticCurveTo(cx - half * 2, cy, cx, cy - eh / 2);
      ctx.stroke();
    } },
    collapse: { life: 1.05, draw(ctx, e, k) {
      const H = e.o.h || 600;
      const reach = H * 0.55;
      const pull = k * k;
      // everything nearby is dragged in on a spiral
      for (let j = 0; j < 44; j++) {
        const s = e.seed + j * 3.1;
        const r0 = reach * (0.25 + hash(s) * 0.75);
        const a0 = hash(s + 1) * TAU;
        const rr = r0 * (1 - pull);
        const a = a0 + pull * (3 + hash(s + 2) * 4);
        const px = e.x + Math.cos(a) * rr, py = e.y + Math.sin(a) * rr;
        const tx = e.x + Math.cos(a - 0.25) * rr * 1.12, ty = e.y + Math.sin(a - 0.25) * rr * 1.12;
        ctx.strokeStyle = rgba(j % 3 ? e.o.rgb : "255,255,255", 0.85 * (1 - k * 0.6));
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
      }
      // the hole swells, then closes
      const R = reach * 0.24 * Math.sin(Math.PI * Math.min(1, k * 1.05));
      ctx.fillStyle = "rgba(0,0,0,0.96)";
      ctx.beginPath(); ctx.arc(e.x, e.y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(mixRgb(e.o.rgb, "255,255,255", 0.5), 0.95);
      ctx.lineWidth = 2.5;
      ctx.shadowColor = rgba(e.o.rgb, 1);
      ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(e.x, e.y, R, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
      if (k > 0.86) {
        const f = (k - 0.86) / 0.14;
        ctx.strokeStyle = rgba("255,255,255", 1 - f);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, reach * 0.5 * f, 0, TAU); ctx.stroke();
      }
    } }
  });

  Object.assign(FX.teleport, {
    notfound: { life: 0.95, draw(ctx, e, k) {
      const r = e.o.r || 10;
      const to = e.o.to || e;
      const a = k < 0.1 ? k / 0.1 : 1 - Math.max(0, (k - 0.55) / 0.45);
      // a dashed box where the ball should be
      ctx.strokeStyle = rgba(e.o.rgb, a);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(e.x - r * 1.3, e.y - r * 1.3, r * 2.6, r * 2.6);
      ctx.setLineDash([]);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.round(r * 1.5)}px monospace`;
      ctx.fillStyle = rgba("255,255,255", a);
      ctx.fillText("404", e.x, e.y - r * 2.5);
      ctx.font = `bold ${Math.max(8, Math.round(r * 0.8))}px monospace`;
      ctx.fillStyle = rgba(e.o.rgb, a);
      ctx.fillText("BALL NOT FOUND", e.x, e.y + r * 2.3);
      // and the answer, where it turned up
      const b = clamp01((k - 0.15) / 0.2) * (1 - Math.max(0, (k - 0.7) / 0.3));
      ctx.fillStyle = `rgba(120,255,160,${b})`;
      ctx.fillText("200 OK", to.x, to.y - r * 2.1 - k * 8);
    } },
    rewind: { life: 0.65, draw(ctx, e, k) {
      const W = e.o.w || 1000;
      const r = e.o.r || 10;
      const to = e.o.to || e;
      const a = Math.sin(Math.PI * Math.min(1, k * 1.1));
      const tick = Math.floor(k * 22);
      // tracking bars across the picture at both ends of the jump
      [e.y, to.y].forEach((cy, w) => {
        for (let i = 0; i < 5; i++) {
          const s = e.seed + i * 3.3 + tick * 0.9 + w * 50;
          const by = cy + (hash(s) - 0.5) * r * 7;
          const bh = 1.5 + hash(s + 1) * 4;
          const off = (hash(s + 2) - 0.5) * 40;
          ctx.fillStyle = i % 2 ? rgba("255,255,255", 0.3 * a) : rgba(e.o.rgb, 0.3 * a);
          ctx.fillRect(off, by, W, bh);
        }
      });
      // the ball scrubs backwards along the jump
      for (let j = 0; j < 5; j++) {
        const q = clamp01(1 - k * 1.25 + j * 0.09);
        const px = e.x + (to.x - e.x) * q, py = e.y + (to.y - e.y) * q;
        ctx.strokeStyle = rgba(e.o.rgb, (0.75 - j * 0.13) * a);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, r * (1 - j * 0.1), 0, TAU); ctx.stroke();
      }
      ctx.font = `bold ${Math.max(9, Math.round(r * 1.1))}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (tick % 2 === 0) {
        ctx.fillStyle = rgba("255,255,255", a);
        ctx.fillText("<< REW", e.x, e.y - r * 2.4);
      }
    } },
    wormhole: { life: 0.75, draw(ctx, e, k) {
      const r = e.o.r || 10;
      const to = e.o.to || e;
      const a = Math.sin(Math.PI * k);
      const light = mixRgb(e.o.rgb, "255,255,255", 0.6);
      // the tunnel bows away from a straight line, like a lensed path
      const mx = (e.x + to.x) / 2, my = (e.y + to.y) / 2;
      const dx = to.x - e.x, dy = to.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      const bx = mx - (dy / len) * len * 0.22, by = my + (dx / len) * len * 0.22;
      const at = (q) => ({
        x: (1 - q) * (1 - q) * e.x + 2 * (1 - q) * q * bx + q * q * to.x,
        y: (1 - q) * (1 - q) * e.y + 2 * (1 - q) * q * by + q * q * to.y
      });
      ctx.strokeStyle = rgba(e.o.rgb, 0.35 * a);
      ctx.lineWidth = r * 1.6;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.quadraticCurveTo(bx, by, to.x, to.y); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.lineWidth = r * 0.9;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.quadraticCurveTo(bx, by, to.x, to.y); ctx.stroke();
      // rings ride down the tunnel
      ctx.lineWidth = 1.5;
      for (let j = 0; j < 7; j++) {
        const q = (j / 7 + k * 1.4) % 1;
        const p = at(q);
        const ring = r * (0.5 + 0.7 * Math.sin(Math.PI * q));
        ctx.strokeStyle = rgba(j % 2 ? light : e.o.rgb, 0.9 * a);
        ctx.beginPath(); ctx.arc(p.x, p.y, ring, 0, TAU); ctx.stroke();
      }
      // a mouth at each end
      [e, to].forEach((p) => {
        for (let ring = 0; ring < 3; ring++) {
          ctx.strokeStyle = rgba(ring === 1 ? "255,255,255" : e.o.rgb, (0.9 - ring * 0.25) * a);
          ctx.beginPath(); ctx.arc(p.x, p.y, r * (1 + ring * 0.7) * (0.4 + 0.6 * a), 0, TAU); ctx.stroke();
        }
      });
    } }
  });

  const CROWN = ["X....X....X", "XX..XXX..XX", "XXX.XXX.XXX", "XXXXXXXXXXX", "XJXXXJXXXJX", "XXXXXXXXXXX"];

  FX.victory = {
    confetti: { life: 2.3, draw(ctx, e, k, age) {
      const W = e.o.w || 1000, H = e.o.h || 600;
      const cols = [e.o.rgb, e.o.rgb, GOLD, "255,255,255", e.o.rgb2 || "255,255,255"];
      const fade = k > 0.8 ? (1 - k) / 0.2 : 1;
      for (let j = 0; j < 90; j++) {
        const s = e.seed + j * 2.37;
        const delay = hash(s) * 0.7;
        const a = age - delay;
        if (a <= 0) continue;
        const fall = 150 + hash(s + 1) * 260;
        const px = hash(s + 2) * W + Math.sin(a * (2 + hash(s + 3) * 3) + j) * 26;
        const py = -16 + fall * a + 60 * a * a;
        if (py > H + 12) continue;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a * (3 + hash(s + 4) * 7) * (j % 2 ? 1 : -1));
        ctx.fillStyle = rgba(cols[j % cols.length], fade);
        const pw = 5 + hash(s + 5) * 6;
        ctx.fillRect(-pw / 2, -2, pw, 4 * Math.abs(Math.cos(a * 6 + j)) + 1);
        ctx.restore();
      }
    } },
    override: { life: 1.9, draw(ctx, e, k) {
      const W = e.o.w || 1000, H = e.o.h || 600;
      const fromLeft = e.x < W / 2;
      const fade = k > 0.82 ? (1 - k) / 0.18 : 1;
      const bars = 14;
      const bh = H / bars;
      for (let j = 0; j < bars; j++) {
        const q = ease(clamp01(k * 2.4 - hash(e.seed + j * 1.7) * 0.5));
        const bw = W * q;
        ctx.fillStyle = rgba(e.o.rgb, (j % 2 ? 0.2 : 0.3) * fade);
        ctx.fillRect(fromLeft ? 0 : W - bw, j * bh, bw, bh - 2);
        ctx.fillStyle = rgba("255,255,255", 0.75 * fade * (1 - q));
        ctx.fillRect(fromLeft ? bw - 3 : W - bw, j * bh, 3, bh - 2);
      }
      if (k > 0.3) {
        // the stamp slams down, slightly crooked
        const s = clamp01((k - 0.3) / 0.1);
        const scale = 2.2 - 1.2 * ease(s);
        const fs = Math.max(16, Math.round(H * 0.085));
        ctx.save();
        ctx.translate(W / 2, H * 0.62);
        ctx.rotate(-0.09);
        ctx.scale(scale, scale);
        ctx.font = `bold ${fs}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const tw = textW(ctx, "SYSTEM OVERRIDE") + fs;
        ctx.strokeStyle = rgba(e.o.rgb, s * fade);
        ctx.lineWidth = 4;
        ctx.strokeRect(-tw / 2, -fs * 0.8, tw, fs * 1.6);
        ctx.fillStyle = rgba(e.o.rgb, s * fade);
        ctx.fillText("SYSTEM OVERRIDE", 0, fs * 0.04);
        ctx.restore();
      }
    } },
    supernova: { life: 2.0, draw(ctx, e, k) {
      const W = e.o.w || 1000, H = e.o.h || 600;
      const reach = Math.hypot(W, H);
      const fade = 1 - k;
      const light = mixRgb(e.o.rgb, "255,255,255", 0.6);
      ctx.globalCompositeOperation = "lighter";
      // rays out to every corner, turning slowly
      const rays = 16;
      for (let j = 0; j < rays; j++) {
        const a = j * TAU / rays + k * 0.9 + hash(e.seed + j) * 0.2;
        const lenR = reach * ease(clamp01(k * 2.2)) * (0.55 + hash(e.seed + j * 3) * 0.45);
        const wdt = 0.035 + hash(e.seed + j * 5) * 0.05;
        ctx.fillStyle = rgba(j % 2 ? light : e.o.rgb, 0.3 * fade);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(a - wdt) * lenR, e.y + Math.sin(a - wdt) * lenR);
        ctx.lineTo(e.x + Math.cos(a + wdt) * lenR, e.y + Math.sin(a + wdt) * lenR);
        ctx.closePath();
        ctx.fill();
      }
      const core = H * (0.12 + 0.5 * ease(clamp01(k * 1.6)));
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, core);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
      g.addColorStop(0.25, rgba(light, 0.6 * fade));
      g.addColorStop(1, rgba(e.o.rgb, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e.x, e.y, core, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      [0, 0.18].forEach((lag) => {
        const q = clamp01((k - lag) * 1.5);
        if (q <= 0 || q >= 1) return;
        ctx.strokeStyle = rgba(lag ? e.o.rgb : "255,255,255", 0.9 * (1 - q));
        ctx.lineWidth = 6 * (1 - q) + 1;
        ctx.beginPath(); ctx.arc(e.x, e.y, reach * 0.6 * ease(q), 0, TAU); ctx.stroke();
      });
    } },
    crown: { life: 2.4, draw(ctx, e, k, age) {
      const H = e.o.h || 600;
      const cell = Math.max(3, Math.round(H * 0.008));
      const cw = CROWN[0].length * cell, ch = CROWN.length * cell;
      const landY = e.y - (e.o.ph || 140) / 2 - ch - 6;
      // drop, land, one small bounce
      const q = clamp01(age / 0.7);
      const drop = 1 - Math.abs(Math.cos(q * Math.PI * 1.5)) * (1 - q);
      const cy = -ch + (landY + ch) * (q >= 1 ? 1 : drop);
      const cx = e.x - cw / 2;
      const fade = k > 0.88 ? (1 - k) / 0.12 : 1;
      // a shaft of light it falls down
      const beam = ctx.createLinearGradient(0, 0, 0, landY + ch);
      beam.addColorStop(0, rgba(GOLD, 0));
      beam.addColorStop(1, rgba(GOLD, 0.22 * fade));
      ctx.fillStyle = beam;
      ctx.fillRect(e.x - cw * 0.9, 0, cw * 1.8, landY + ch);
      ctx.shadowColor = rgba(GOLD, 0.9 * fade);
      ctx.shadowBlur = 16;
      CROWN.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const c = row[rx];
          if (c === ".") continue;
          ctx.fillStyle = c === "J" ? rgba(e.o.rgb, fade) : rgba(ry < 3 ? "255,236,170" : GOLD, fade);
          ctx.fillRect(cx + rx * cell, cy + ry * cell, cell, cell);
        }
      });
      ctx.shadowBlur = 0;
      if (q >= 1) {
        for (let j = 0; j < 7; j++) {
          const s = e.seed + j * 4.1;
          const ph = (age * (0.9 + hash(s)) + hash(s + 1)) % 1;
          twinkle(ctx, e.x + (hash(s + 2) - 0.5) * cw * 2.4, cy + ch / 2 + (hash(s + 3) - 0.5) * ch * 3, 2 + 5 * Math.sin(Math.PI * ph), Math.sin(Math.PI * ph) * fade);
        }
      }
    } }
  };

  // ═══ Net ═════════════════════════════════════════════════════════════════
  // The centre line. o = { x, h, t, heat (0-1), rgbL, rgbR, quality }.
  // Nets are drawn dimmer than the ball and paddles on purpose.

  const NET_RENDERERS = {
    tape(ctx, o) {
      ctx.fillStyle = "rgba(240,246,255,0.42)";
      for (let y = 6; y < o.h; y += 38) ctx.fillRect(o.x - 3.5, y, 7, 22);
    },
    laser(ctx, o) {
      const heat = o.heat || 0;
      const flick = 0.75 + 0.25 * hash(Math.floor(o.t * 40));
      const half = 1.5 + heat * 2;
      ctx.shadowBlur = o.quality < 0.55 ? 6 : 14 + heat * 12;
      ctx.shadowColor = rgba(o.rgbL, 0.9);
      ctx.fillStyle = rgba(o.rgbL, (0.55 + heat * 0.3) * flick);
      ctx.fillRect(o.x - half, 0, half, o.h);
      ctx.shadowColor = rgba(o.rgbR, 0.9);
      ctx.fillStyle = rgba(o.rgbR, (0.55 + heat * 0.3) * flick);
      ctx.fillRect(o.x, 0, half, o.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255,255,255,${0.55 * flick})`;
      ctx.fillRect(o.x - 0.5, 0, 1, o.h);
      // hot spots run along the beam
      for (let i = 0; i < 3; i++) {
        const y = ((o.t * (90 + i * 40) + i * 190) % (o.h + 40)) - 20;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(o.x - half - 1, y, half * 2 + 2, 6);
      }
    },
    marquee(ctx, o) {
      const step = Math.floor(o.t * 6);
      let i = 0;
      for (let y = 14; y < o.h; y += 26, i++) {
        const lit = (i + step) % 3 === 0;
        ctx.fillStyle = "rgba(40,28,10,0.8)";
        ctx.beginPath(); ctx.arc(o.x, y, 5.5, 0, TAU); ctx.fill();
        ctx.shadowColor = "rgba(255,200,90,0.9)";
        ctx.shadowBlur = lit && o.quality >= 0.55 ? 12 : 0;
        ctx.fillStyle = lit ? "rgba(255,226,150,0.95)" : "rgba(150,104,40,0.5)";
        ctx.beginPath(); ctx.arc(o.x, y, 4, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }
    },
    waveform(ctx, o) {
      const heat = o.heat || 0;
      const amp = 3 + heat * 15;
      const line = (rgb, phase, alpha) => {
        ctx.strokeStyle = rgba(rgb, alpha);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let y = 0; y <= o.h; y += 5) {
          const x = o.x + (Math.sin(y * 0.045 + o.t * 4.2 + phase) * 0.6 + Math.sin(y * 0.13 - o.t * 7.1 + phase) * 0.4) * amp
            + (hash(Math.floor(y / 5) + Math.floor(o.t * 20) * 3.3) - 0.5) * heat * 6;
          if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      line(o.rgbL, 0, 0.5);
      line(o.rgbR, 2.1, 0.5);
      line("255,255,255", 1.0, 0.3);
    },
    codefall(ctx, o) {
      const fs = 14;
      const rows = Math.ceil(o.h / fs) + 1;
      ctx.font = `bold ${fs}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const streak = 10;
      for (let k = 0; k < rows; k++) {
        let alpha = 0.1, col = "0,255,90";
        for (let s = 0; s < 3; s++) {
          const cycle = rows + streak * 2;
          const head = ((o.t * (7 + s * 3) + s * cycle / 3) % cycle) - streak;
          const d = head - k;
          if (d >= 0 && d < 1) { alpha = 0.95; col = "230,255,240"; }
          else if (d >= 1 && d < streak) alpha = Math.max(alpha, 0.75 * (1 - d / streak));
        }
        const glyph = MATRIX_GLYPHS[Math.floor(hash(k * 7.7 + Math.floor(o.t * 5 + k * 0.3)) * MATRIX_GLYPHS.length)];
        ctx.fillStyle = rgba(col, alpha);
        ctx.fillText(glyph, o.x, k * fs);
      }
    }
  };

  // Returns false for the default, so the arena draws its own line.
  function drawNet(ctx, id, o) {
    const fn = NET_RENDERERS[id];
    if (!fn) return false;
    const opts = Object.assign({ x: 500, h: 600, t: 0, heat: 0, rgbL: "0,217,255", rgbR: "255,79,216", quality: 1 }, o || {});
    ctx.save();
    try {
      fn(ctx, opts);
      if (opts.gilded) {
        for (let i = 0; i < 4; i++) {
          const ph = (opts.t * 0.35 + i / 4) % 1;
          twinkle(ctx, opts.x + (i % 2 ? 7 : -7), ph * opts.h, 4, Math.sin(Math.PI * ph) * 0.9);
        }
      }
    } finally { ctx.restore(); }
    return true;
  }

  // ═══ Score displays ══════════════════════════════════════════════════════
  // One per side: drawScoreboard(ctx, id, value, { x, y, size, rgb, t, flash })
  // x,y = centre, size = digit height, flash = 1 → 0 after that side scores.

  //        a
  //      f   b
  //        g
  //      e   c
  //        d
  const SEGMENTS = ["abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abfgcd"];

  function sevenSegDigit(ctx, digit, x, y, w, h, rgb, alpha) {
    const t = Math.max(2, h * 0.11);
    const on = SEGMENTS[digit] || "";
    const seg = {
      a: [x + t, y, w - 2 * t, t], d: [x + t, y + h - t, w - 2 * t, t], g: [x + t, y + h / 2 - t / 2, w - 2 * t, t],
      f: [x, y + t, t, h / 2 - t * 1.5], b: [x + w - t, y + t, t, h / 2 - t * 1.5],
      e: [x, y + h / 2 + t / 2, t, h / 2 - t * 1.5], c: [x + w - t, y + h / 2 + t / 2, t, h / 2 - t * 1.5]
    };
    Object.keys(seg).forEach((name) => {
      const lit = on.includes(name);
      ctx.fillStyle = rgba(rgb, lit ? alpha : alpha * 0.09);
      ctx.fillRect(seg[name][0], seg[name][1], seg[name][2], seg[name][3]);
    });
  }

  // 5×7 bitmaps, one string of 35 cells per digit.
  const DOT_FONT = [
    "01110100011001110101110011000101110", "00100011000010000100001000010001110", "01110100010000100010001000100011111",
    "11110000010000101110000010000111110", "00010001100101010010111110001000010", "11111100001111000001000011000101110",
    "00110010001000011110100011000101110", "11111000010001000100010000100001000", "01110100011000101110100011000101110",
    "01110100011000101111000010001001100"
  ];

  const BOARD_RENDERERS = {
    sevenseg(ctx, digits, o) {
      const dh = o.size, dw = dh * 0.52, gap = dh * 0.16;
      const total = digits.length * dw + (digits.length - 1) * gap;
      ctx.shadowColor = rgba(o.rgb, 0.8);
      ctx.shadowBlur = o.quality < 0.55 ? 0 : 10 + o.flash * 16;
      digits.forEach((d, i) => sevenSegDigit(ctx, d, o.x - total / 2 + i * (dw + gap), o.y - dh / 2, dw, dh, o.flash > 0.5 ? mixRgb(o.rgb, "255,255,255", 0.5) : o.rgb, 0.9));
    },
    dotmatrix(ctx, digits, o) {
      const cell = o.size / 7;
      const dw = cell * 5, gap = cell * 1.4;
      const total = digits.length * dw + (digits.length - 1) * gap;
      digits.forEach((d, i) => {
        const x0 = o.x - total / 2 + i * (dw + gap), y0 = o.y - o.size / 2;
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < 5; col++) {
            const lit = DOT_FONT[d][row * 5 + col] === "1";
            // a scored point sweeps down the board one row at a time
            const sweep = o.flash > 0 && Math.floor((1 - o.flash) * 9) === row;
            ctx.fillStyle = lit ? rgba(sweep ? "255,255,255" : o.rgb, 0.95) : rgba(o.rgb, sweep ? 0.3 : 0.1);
            ctx.beginPath(); ctx.arc(x0 + (col + 0.5) * cell, y0 + (row + 0.5) * cell, cell * 0.38, 0, TAU); ctx.fill();
          }
        }
      });
    },
    flipclock(ctx, digits, o) {
      const ch = o.size, cw = ch * 0.68, gap = ch * 0.1;
      const total = digits.length * cw + (digits.length - 1) * gap;
      digits.forEach((d, i) => {
        const x0 = o.x - total / 2 + i * (cw + gap), y0 = o.y - ch / 2;
        ctx.fillStyle = "rgba(24,24,32,0.96)";
        ctx.fillRect(x0, y0, cw, ch);
        ctx.strokeStyle = rgba(o.rgb, 0.85);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, cw - 1, ch - 1);
        ctx.font = `bold ${Math.round(ch * 0.8)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(240,244,255,0.96)";
        ctx.fillText(String(d), x0 + cw / 2, y0 + ch * 0.54);
        // the top flap falls shut as the point lands
        if (o.flash > 0.02) {
          const fall = 1 - o.flash;
          ctx.fillStyle = "rgba(52,52,66,0.98)";
          ctx.fillRect(x0 + 1, y0 + 1, cw - 2, (ch / 2 - 1) * (1 - fall));
          ctx.fillStyle = rgba(o.rgb, 0.9);
          ctx.fillRect(x0 + 1, y0 + (ch / 2 - 1) * (1 - fall), cw - 2, 1.5);
        }
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(x0, y0 + ch / 2 - 1, cw, 2);
        // hinge pins
        ctx.fillStyle = "rgba(170,170,190,0.9)";
        ctx.fillRect(x0 - 1.5, y0 + ch / 2 - 3, 3, 6);
        ctx.fillRect(x0 + cw - 1.5, y0 + ch / 2 - 3, 3, 6);
      });
    },
    nixie(ctx, digits, o) {
      const th = o.size, tw = th * 0.56, gap = th * 0.12;
      const total = digits.length * tw + (digits.length - 1) * gap;
      const rad = tw / 2;
      digits.forEach((d, i) => {
        const x0 = o.x - total / 2 + i * (tw + gap), y0 = o.y - th / 2;
        // the glass
        ctx.beginPath();
        ctx.moveTo(x0, y0 + th);
        ctx.lineTo(x0, y0 + rad);
        ctx.arc(x0 + rad, y0 + rad, rad, Math.PI, 0);
        ctx.lineTo(x0 + tw, y0 + th);
        ctx.closePath();
        ctx.fillStyle = "rgba(40,22,14,0.55)";
        ctx.fill();
        ctx.strokeStyle = "rgba(210,225,255,0.55)";
        ctx.lineWidth = 1.25;
        ctx.stroke();
        // the unlit numerals stacked behind
        ctx.font = `${Math.round(th * 0.6)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,150,70,0.09)";
        [8, 3].forEach((ghost) => ctx.fillText(String(ghost), x0 + tw / 2, y0 + th * 0.58));
        // the lit one, with a warm flicker
        const flick = 0.85 + 0.15 * hash(Math.floor(o.t * 30) + i * 3.3);
        ctx.shadowColor = "rgba(255,120,40,0.95)";
        ctx.shadowBlur = o.quality < 0.55 ? 6 : 14 + o.flash * 14;
        ctx.fillStyle = `rgba(255,${Math.round(170 + o.flash * 70)},${Math.round(90 + o.flash * 120)},${0.95 * flick})`;
        ctx.fillText(String(d), x0 + tw / 2, y0 + th * 0.58);
        ctx.shadowBlur = 0;
        // the base carries the side's colour
        ctx.fillStyle = rgba(o.rgb, 0.9);
        ctx.fillRect(x0 - 1, y0 + th - th * 0.09, tw + 2, th * 0.09);
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(x0 + tw * 0.2, y0 + rad * 0.7, 1.5, th * 0.5);
      });
    }
  };

  function drawScoreboard(ctx, id, value, o) {
    const fn = BOARD_RENDERERS[id];
    if (!fn) return false;
    const opts = Object.assign({ x: 100, y: 60, size: 60, rgb: "0,217,255", t: 0, flash: 0, quality: 1, alpha: 0.5 }, o || {});
    opts.flash = clamp01(opts.flash);
    const n = Math.max(0, Math.min(99, Math.floor(Number(value) || 0)));
    const digits = n >= 10 ? [Math.floor(n / 10), n % 10] : [n];
    ctx.save();
    try {
      // dim while the ball is in play, bright for a moment after a point
      ctx.globalAlpha = (ctx.globalAlpha == null ? 1 : ctx.globalAlpha) * Math.min(1, opts.alpha + opts.flash * 0.5);
      fn(ctx, digits, opts);
      if (opts.gilded) {
        const half = opts.size * (digits.length > 1 ? 0.95 : 0.55);
        ctx.fillStyle = rgba(GOLD, 0.9);
        ctx.fillRect(opts.x - half, opts.y + opts.size * 0.62, half * 2, 2);
        const ph = (opts.t * 0.5) % 1;
        twinkle(ctx, opts.x - half + ph * half * 2, opts.y + opts.size * 0.62 + 1, 5, Math.sin(Math.PI * ph));
      }
    } finally { ctx.restore(); }
    return true;
  }

  // ═══ Countdowns ══════════════════════════════════════════════════════════
  // drawCountdown(ctx, id, key, progress, { w, h, t, rgbL, rgbR })
  // key = "3" | "2" | "1" | "GO", progress = 0 → 1 through that beat.

  const COUNTDOWN_RENDERERS = {
    segment(ctx, key, p, o) {
      const dh = o.h * 0.34;
      const cx = o.w / 2, cy = o.h / 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.round(o.h * 0.032)}px monospace`;
      ctx.fillStyle = "rgba(255,190,90,0.85)";
      ctx.fillText(key === "GO" ? "IGNITION" : "T-MINUS", cx, cy - dh * 0.72);
      ctx.shadowColor = "rgba(255,150,40,0.9)";
      ctx.shadowBlur = 22;
      if (key === "GO") {
        ctx.font = `bold ${Math.round(dh * 0.9)}px monospace`;
        ctx.fillStyle = "rgba(255,214,120,1)";
        ctx.fillText("GO", cx, cy + dh * 0.04);
      } else {
        const dw = dh * 0.52;
        // 00:0N, like a launch clock
        const total = dw * 4 + dh * 0.16 * 3 + dh * 0.2;
        let x = cx - total / 2;
        [0, 0, null, 0, Number(key)].forEach((d) => {
          if (d === null) {
            ctx.fillStyle = "rgba(255,170,60,0.95)";
            ctx.fillRect(x, cy - dh * 0.2, dh * 0.08, dh * 0.08);
            ctx.fillRect(x, cy + dh * 0.12, dh * 0.08, dh * 0.08);
            x += dh * 0.2;
            return;
          }
          sevenSegDigit(ctx, d, x, cy - dh / 2, dw, dh, "255,170,60", 1);
          x += dw + dh * 0.16;
        });
      }
      ctx.shadowBlur = 0;
      // a bar that drains through the beat
      ctx.fillStyle = "rgba(255,190,90,0.25)";
      ctx.fillRect(cx - dh, cy + dh * 0.72, dh * 2, 4);
      ctx.fillStyle = "rgba(255,190,90,0.95)";
      ctx.fillRect(cx - dh, cy + dh * 0.72, dh * 2 * (1 - p), 4);
    },
    terminal(ctx, key, p, o) {
      const fs = Math.max(13, Math.round(o.h * 0.058));
      const go = key === "GO";
      const full = go ? "> ./serve --now" : `> serve --in ${key}`;
      const typed = full.slice(0, Math.max(2, Math.ceil(full.length * Math.min(1, p * 2.4))));
      ctx.font = `bold ${fs}px monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const tw = textW(ctx, full) + fs * 2.2;
      const x0 = o.w / 2 - tw / 2, y0 = o.h / 2 - fs * 1.5;
      ctx.fillStyle = "rgba(4,10,8,0.88)";
      ctx.fillRect(x0, y0, tw, fs * 3);
      ctx.strokeStyle = go ? "rgba(255,214,120,0.9)" : "rgba(90,255,150,0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 1, y0 + 1, tw - 2, fs * 3 - 2);
      // title bar
      ctx.fillStyle = go ? "rgba(255,214,120,0.9)" : "rgba(90,255,150,0.8)";
      ctx.fillRect(x0, y0, tw, fs * 0.5);
      ctx.shadowColor = go ? "rgba(255,214,120,0.9)" : "rgba(90,255,150,0.9)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = go ? "rgba(255,236,170,1)" : "rgba(150,255,190,1)";
      ctx.fillText(typed, x0 + fs, o.h / 2 + fs * 0.25);
      if (Math.floor(o.t * 6) % 2 === 0) ctx.fillRect(x0 + fs + textW(ctx, typed) + 3, o.h / 2 - fs * 0.22, fs * 0.55, fs);
      ctx.shadowBlur = 0;
    },
    insertcoin(ctx, key, p, o) {
      const cx = o.w / 2, cy = o.h / 2;
      const r = o.h * 0.1;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (key === "GO") {
        ctx.shadowColor = "rgba(255,214,120,0.9)";
        ctx.shadowBlur = 26;
        ctx.font = `bold ${Math.round(o.h * 0.3)}px monospace`;
        ctx.fillStyle = "rgba(255,214,120,1)";
        ctx.fillText("GO", cx, cy);
        ctx.shadowBlur = 0;
        ctx.font = `bold ${Math.round(o.h * 0.035)}px monospace`;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("CREDIT 00", cx, cy + o.h * 0.2);
        return;
      }
      const n = Number(key);
      const spacing = r * 2.5;
      for (let i = 0; i < n; i++) {
        const x = cx + (i - (n - 1) / 2) * spacing;
        // each coin lands a moment after the last and spins as it settles
        const land = clamp01(p * 5 - i * 0.6);
        const y = cy - (1 - ease(land)) * o.h * 0.25;
        const spin = (1 - land) * 6 + Math.sin(o.t * 2 + i) * 0.25;
        const rx = Math.max(r * 0.12, Math.abs(Math.cos(spin)) * r);
        ctx.shadowColor = "rgba(255,200,90,0.8)";
        ctx.shadowBlur = 18;
        const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
        g.addColorStop(0, "#fff0b8"); g.addColorStop(0.5, "#f0c24a"); g.addColorStop(1, "#9a6a14");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, rx, r, 0, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(122,84,16,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y, rx * 0.72, r * 0.72, 0, 0, TAU); ctx.stroke();
        if (rx > r * 0.6) {
          ctx.fillStyle = "rgba(110,74,12,0.95)";
          ctx.font = `bold ${Math.round(r * 0.95)}px monospace`;
          ctx.fillText("1", x, y + r * 0.05);
        }
      }
      ctx.font = `bold ${Math.round(o.h * 0.035)}px monospace`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(`CREDIT 0${n}`, cx, cy + o.h * 0.2);
    },
    glitchtype(ctx, key, p, o) {
      const fs = Math.round(o.h * (key === "GO" ? 0.4 : 0.5));
      const cx = o.w / 2, cy = o.h / 2 + fs * 0.04;
      const tick = Math.floor(o.t * 14);
      const split = 6 + 14 * (1 - p) + (hash(tick) > 0.7 ? 10 : 0);
      ctx.font = `bold ${fs}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = rgba(o.rgbL, 0.85);
      ctx.fillText(key, cx - split, cy);
      ctx.fillStyle = rgba(o.rgbR, 0.85);
      ctx.fillText(key, cx + split, cy);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.fillText(key, cx, cy);
      // slices knocked out of the numeral
      for (let i = 0; i < 4; i++) {
        const sy = cy - fs / 2 + hash(tick * 1.3 + i * 5.1) * fs;
        ctx.fillStyle = i % 2 ? rgba(o.rgbL, 0.5) : "rgba(0,0,0,0.75)";
        ctx.fillRect(cx - fs + (hash(tick + i) - 0.5) * 40, sy, fs * 2, 2 + hash(i * 2.2 + tick) * 6);
      }
    }
  };

  // Returns false for the default, so the game draws its own artwork.
  function drawCountdown(ctx, id, key, progress, o) {
    const fn = COUNTDOWN_RENDERERS[id];
    if (!fn) return false;
    const opts = Object.assign({ w: 1000, h: 600, t: 0, rgbL: "0,217,255", rgbR: "255,79,216", quality: 1 }, o || {});
    const p = clamp01(progress);
    const go = key === "GO";
    const alpha = go ? 1 - Math.max(0, (p - 0.45) / 0.55) : 1 - Math.max(0, (p - 0.72) / 0.28);
    const scale = go ? 0.84 + p * 0.26 : 0.8 + p * 0.2;
    ctx.save();
    try {
      ctx.globalAlpha = (ctx.globalAlpha == null ? 1 : ctx.globalAlpha) * Math.max(0, alpha);
      ctx.translate(opts.w / 2, opts.h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-opts.w / 2, -opts.h / 2);
      fn(ctx, String(key), p, opts);
    } finally { ctx.restore(); }
    return true;
  }

  // ═══ Titles and nameplates ═══════════════════════════════════════════════
  // drawNameplate(ctx, plateId, x, y, { name, title, rgb, align, t, alpha })
  // x is the plate's left edge, right edge or centre, depending on align;
  // y is its top. Returns { w, h }.

  const PLATE_RENDERERS = {
    neon(ctx, b, o) {
      const flick = hash(Math.floor(o.t * 9)) > 0.93 ? 0.45 : 1;
      ctx.fillStyle = "rgba(6,8,16,0.72)";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.shadowColor = rgba(o.rgb, 0.95);
      ctx.shadowBlur = 14;
      ctx.strokeStyle = rgba(o.rgb, flick);
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba("255,255,255", 0.7 * flick);
      ctx.lineWidth = 0.75;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    },
    hazard(ctx, b, o) {
      ctx.fillStyle = "rgba(14,12,8,0.86)";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x, b.y, b.w, 5);
      ctx.rect(b.x, b.y + b.h - 5, b.w, 5);
      ctx.clip();
      ctx.fillStyle = "rgb(255,205,40)";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = "rgb(16,14,10)";
      const shift = (o.t * 10) % 14;
      for (let sx = b.x - b.h - 14 + shift; sx < b.x + b.w + 14; sx += 14) {
        ctx.beginPath();
        ctx.moveTo(sx, b.y + b.h); ctx.lineTo(sx + 7, b.y + b.h); ctx.lineTo(sx + 7 + b.h, b.y); ctx.lineTo(sx + b.h, b.y);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
    holo(ctx, b, o) {
      const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
      for (let i = 0; i <= 5; i++) g.addColorStop(i / 5, `hsla(${((i / 5 + o.t * 0.12) % 1) * 360},85%,62%,0.55)`);
      ctx.fillStyle = "rgba(8,8,18,0.8)";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = g;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.save();
      ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
      const sx = b.x - 30 + ((o.t * 0.45) % 1) * (b.w + 60);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.moveTo(sx, b.y + b.h); ctx.lineTo(sx + 12, b.y + b.h); ctx.lineTo(sx + 12 + b.h * 0.6, b.y); ctx.lineTo(sx + b.h * 0.6, b.y);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    },
    gold(ctx, b, o) {
      const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      g.addColorStop(0, "#fff0b8"); g.addColorStop(0.45, "#e8b93e"); g.addColorStop(1, "#8a5c10");
      ctx.shadowColor = "rgba(255,200,90,0.7)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = g;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(110,72,10,0.9)";
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 3.5, b.y + 3.5, b.w - 7, b.h - 7);
      ctx.fillStyle = "rgba(90,58,8,0.95)";
      [[4, 4], [b.w - 6, 4], [4, b.h - 6], [b.w - 6, b.h - 6]].forEach(([rx, ry]) => ctx.fillRect(b.x + rx, b.y + ry, 2, 2));
      const ph = (o.t * 0.4) % 1;
      twinkle(ctx, b.x + ph * b.w, b.y + 3, 4, Math.sin(Math.PI * ph), "255,255,255");
      b.ink = "40,24,0";
      b.sub = "90,58,8";
    },
    allseeing(ctx, b, o) {
      ctx.fillStyle = "rgba(22,6,12,0.9)";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "rgba(255,70,90,0.3)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(b.x + b.w * hash(i * 2.1), b.y);
        ctx.lineTo(b.x + b.w * hash(i * 3.7 + 1), b.y + b.h);
        ctx.stroke();
      }
      // an eye set into the end of the plate; it blinks and looks around
      const ex = b.align === "right" ? b.x + b.w - b.h * 0.55 : b.x + b.h * 0.55;
      const ey = b.y + b.h / 2;
      const er = b.h * 0.3;
      const blink = (o.t % 4.1) < 0.14 ? 0.12 : 1;
      ctx.fillStyle = "rgba(255,240,240,0.96)";
      ctx.beginPath(); ctx.ellipse(ex, ey, er * 1.25, er * blink, 0, 0, TAU); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ex, ey, er * 1.25, er * blink, 0, 0, TAU); ctx.clip();
      const look = Math.sin(o.t * 0.9) * er * 0.5;
      ctx.fillStyle = rgba(o.rgb, 1);
      ctx.beginPath(); ctx.arc(ex + look, ey, er * 0.62, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgb(8,0,4)";
      ctx.beginPath(); ctx.arc(ex + look, ey, er * 0.28, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = rgba(o.rgb, 0.95);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x + 0.75, b.y + 0.75, b.w - 1.5, b.h - 1.5);
      b.inset = 38;
    }
  };

  function drawNameplate(ctx, plateId, x, y, o) {
    const opts = Object.assign({ name: "PLAYER", title: "", rgb: "0,217,255", align: "left", t: 0, alpha: 1 }, o || {});
    const name = String(opts.name || "PLAYER").toUpperCase().slice(0, 20);
    const title = String(opts.title || "").toUpperCase().slice(0, 24);
    const framed = !!PLATE_RENDERERS[plateId];
    ctx.save();
    try {
      ctx.globalAlpha = (ctx.globalAlpha == null ? 1 : ctx.globalAlpha) * clamp01(opts.alpha);
      ctx.font = "bold 15px monospace";
      const nameW = textW(ctx, name);
      ctx.font = "bold 9px monospace";
      const titleW = title ? textW(ctx, title) : 0;
      const extra = plateId === "allseeing" ? 38 : 0;        // room for the eye
      const w = Math.max(nameW, titleW) + (framed ? 26 : 4) + extra;
      const h = title ? 40 : 28;
      const left = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
      const box = { x: left, y, w, h, align: opts.align, ink: null, sub: null, inset: 0 };
      if (framed) PLATE_RENDERERS[plateId](ctx, box, opts);
      const pad = framed ? 13 : 2;
      const tx = opts.align === "right" ? left + w - pad - box.inset
        : opts.align === "center" ? left + (w + box.inset) / 2 : left + pad + box.inset;
      ctx.textAlign = opts.align === "center" ? "center" : opts.align === "right" ? "right" : "left";
      ctx.textBaseline = "middle";
      ctx.font = "bold 15px monospace";
      if (!box.ink) { ctx.shadowColor = rgba(opts.rgb, 0.9); ctx.shadowBlur = 10; }
      ctx.fillStyle = box.ink ? rgba(box.ink, 1) : framed ? "rgba(244,250,255,0.98)" : rgba(mixRgb(opts.rgb, "255,255,255", 0.25), 1);
      ctx.fillText(name, tx, y + (title ? 15 : h / 2 + 1));
      ctx.shadowBlur = 0;
      if (title) {
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = box.sub ? rgba(box.sub, 1) : rgba(mixRgb(opts.rgb, "255,255,255", 0.55), 0.92);
        ctx.fillText(title, tx, y + 30);
      }
      return { w, h };
    } finally { ctx.restore(); }
  }

  // ═══ Set bonuses ═════════════════════════════════════════════════════════
  // Drawn behind the ball on the side wearing the full set.
  // o = { side (−1 left, +1 right), w, h, t, rgb, ballX, ballY, quality }

  const SET_RENDERERS = {
    eye(ctx, o) {
      const cx = o.side < 0 ? o.w * 0.2 : o.w * 0.8, cy = o.h / 2;
      const ew = o.w * 0.11, eh = o.h * 0.16;
      const blink = (o.t % 5.3) < 0.16 ? 0.1 : 1;
      ctx.strokeStyle = rgba(o.rgb, 0.3);
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(255,235,235,0.07)";
      ctx.beginPath();
      ctx.moveTo(cx - ew, cy);
      ctx.quadraticCurveTo(cx, cy - eh * 1.5 * blink, cx + ew, cy);
      ctx.quadraticCurveTo(cx, cy + eh * 1.5 * blink, cx - ew, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.clip();
      const dx = (o.ballX == null ? cx : o.ballX) - cx, dy = (o.ballY == null ? cy : o.ballY) - cy;
      const d = Math.hypot(dx, dy) || 1;
      const px = cx + (dx / d) * Math.min(ew * 0.45, d * 0.12), py = cy + (dy / d) * Math.min(eh * 0.35, d * 0.12);
      ctx.fillStyle = rgba(o.rgb, 0.24);
      ctx.beginPath(); ctx.arc(px, py, eh * 0.52, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath(); ctx.arc(px, py, eh * 0.22, 0, TAU); ctx.fill();
      ctx.restore();
    },
    void(ctx, o) {
      const cx = o.side < 0 ? 0 : o.w, cy = o.h / 2;
      const count = o.quality < 0.55 ? 14 : 28;
      for (let i = 0; i < count; i++) {
        const life = (o.t * (0.07 + hash(i) * 0.08) + hash(i * 3.1)) % 1;
        const r = o.w * 0.42 * (1 - life) * (1 - life);
        const a = hash(i * 7.7) * Math.PI - Math.PI / 2 + life * 3;
        const px = cx - o.side * Math.abs(Math.cos(a)) * r, py = cy + Math.sin(a) * r * 1.3;
        ctx.fillStyle = rgba(i % 3 ? "255,255,255" : o.rgb, 0.5 * Math.sin(Math.PI * life));
        ctx.fillRect(px - 1, py - 1, 2 + (1 - life), 2 + (1 - life));
      }
    },
    arcade(ctx, o) {
      const x = o.side < 0 ? 7 : o.w - 7;
      const step = Math.floor(o.t * 7);
      let i = 0;
      for (let y = 12; y < o.h; y += 24, i++) {
        const lit = (i + step) % 4 < 2;
        ctx.shadowColor = "rgba(255,200,90,0.9)";
        ctx.shadowBlur = lit && o.quality >= 0.55 ? 10 : 0;
        ctx.fillStyle = lit ? (i % 2 ? rgba(o.rgb, 0.95) : "rgba(255,226,150,0.95)") : "rgba(110,80,40,0.35)";
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }
    },
    tape(ctx, o) {
      const x0 = o.side < 0 ? 0 : o.w / 2;
      const ty = ((o.t * 0.11) % 1) * (o.h + 60) - 30;
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = rgba(i % 2 ? "255,255,255" : o.rgb, 0.08);
        ctx.fillRect(x0 + (hash(i + Math.floor(o.t * 12)) - 0.5) * 12, ty + i * 4, o.w / 2, 2);
      }
      if (Math.floor(o.t * 1.2) % 2 === 0) {
        ctx.font = `bold ${Math.max(11, Math.round(o.h * 0.03))}px monospace`;
        ctx.textAlign = o.side < 0 ? "left" : "right";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText("PLAY >", o.side < 0 ? o.w * 0.08 : o.w * 0.92, o.h * 0.9);
      }
    }
  };

  function drawSetBonus(ctx, setId, o) {
    const fn = SET_RENDERERS[setId];
    if (!fn) return false;
    const opts = Object.assign({ side: -1, w: 1000, h: 600, t: 0, rgb: "0,217,255", quality: 1 }, o || {});
    ctx.save();
    try { fn(ctx, opts); } finally { ctx.restore(); }
    return true;
  }

  // ═══ Gold trim (mastery) ═════════════════════════════════════════════════
  // One overlay per kind of item, drawn on top of whatever the item drew, so
  // every skin and effect gets its trim without knowing about it.

  function gildPaddle(ctx, x, y, w, h, o) {
    ctx.save();
    ctx.strokeStyle = rgba(GOLD, 0.95);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 2.25, y - 2.25, w + 4.5, h + 4.5);
    // corner caps
    ctx.fillStyle = rgba("255,240,190", 0.98);
    [[x - 3.5, y - 3.5], [x + w - 1.5, y - 3.5], [x - 3.5, y + h - 1.5], [x + w - 1.5, y + h - 1.5]].forEach(([cx, cy]) => ctx.fillRect(cx, cy, 5, 5));
    // a glint runs round the frame
    const per = 2 * (w + h);
    for (let i = 0; i < 2; i++) {
      let d = ((o.t * 60 + i * per / 2) % per);
      let gx, gy;
      if (d < h) { gx = x - 2; gy = y + d; }
      else if (d < h + w) { gx = x + (d - h); gy = y + h + 2; }
      else if (d < 2 * h + w) { gx = x + w + 2; gy = y + h - (d - h - w); }
      else { gx = x + w - (d - 2 * h - w); gy = y - 2; }
      twinkle(ctx, gx, gy, 4.5, 0.95);
    }
    ctx.restore();
  }

  function gildBall(ctx, x, y, r, o) {
    ctx.save();
    ctx.strokeStyle = rgba(GOLD, 0.9);
    ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.arc(x, y, r * 1.45, 0, TAU); ctx.stroke();
    for (let i = 0; i < 2; i++) {
      const a = (o.t || 0) * 4 + i * Math.PI;
      twinkle(ctx, x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45, Math.max(3, r * 0.45), 0.95);
    }
    ctx.restore();
  }

  function gildTrail(ctx, trail, o) {
    ctx.save();
    const n = trail.length;
    for (let i = 2; i < n; i += 2) {
      const p = trail[i];
      const f = 1 - i / n;
      const seed = i * 3.3;
      const ph = ((o.t || 0) * 1.6 + hash(seed)) % 1;
      twinkle(ctx, p.x + (hash(seed + 1) - 0.5) * o.r * 2.4, p.y + (hash(seed + 2) - 0.5) * o.r * 2.4, 1.5 + 3 * f, Math.sin(Math.PI * ph) * (0.25 + 0.75 * f));
    }
    ctx.restore();
  }

  function gildDash(ctx, trail, o) {
    ctx.save();
    trail.forEach((tr, i) => {
      const a = Math.max(0, tr.life / 16);
      ctx.strokeStyle = rgba(GOLD, 0.8 * a);
      ctx.lineWidth = 1.25;
      ctx.strokeRect(tr.x - 1.5, tr.y - 1.5, o.w + 3, o.h + 3);
      twinkle(ctx, tr.x + (i % 2 ? o.w + 2 : -2), tr.y + o.h * hash(i * 2.7 + 1), 3.5, a);
    });
    ctx.restore();
  }

  function gildFx(ctx, e, k, age) {
    const reach = 26 + (e.o.r || 10) * 3;
    for (let j = 0; j < 8; j++) {
      const s = e.seed + j * 6.7;
      const a = hash(s) * TAU;
      const d = reach * (0.3 + hash(s + 1) * 0.9) * ease(clamp01(k * 1.8));
      twinkle(ctx, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d - age * 14, 2 + 4 * hash(s + 2), Math.sin(Math.PI * clamp01(k * 1.3)));
    }
  }

  // ═══ Sound packs ═════════════════════════════════════════════════════════
  // Synthesised with Web Audio, so a pack needs no sound files.
  // playSound(audioContext, packId, "hit" | "score", { charge, n, volume })
  // returns false for the default pack, so the game plays its own recording.

  const noiseBuffers = typeof WeakMap === "function" ? new WeakMap() : null;
  function noiseBuffer(ac) {
    let buf = noiseBuffers && noiseBuffers.get(ac);
    if (buf) return buf;
    const rate = Number(ac.sampleRate) || 44100;
    buf = ac.createBuffer(1, Math.floor(rate * 0.6), rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    if (noiseBuffers) noiseBuffers.set(ac, buf);
    return buf;
  }

  function envelope(ac, dest, t0, dur, peak, attack) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(dest);
    return g;
  }

  function tone(ac, dest, type, f0, f1, t0, dur, peak) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    osc.connect(envelope(ac, dest, t0, dur, peak));
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise(ac, dest, filterType, freq, t0, dur, peak) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    const filter = ac.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t0);
    src.connect(filter);
    filter.connect(envelope(ac, dest, t0, dur, peak, 0.002));
    src.start(t0, Math.random() * 0.3);
    src.stop(t0 + dur + 0.03);
  }

  const SOUND_SYNTHS = {
    chiptune: {
      hit(ac, out, t, o) {
        const scale = [0, 2, 4, 7, 9, 12];
        const f = 392 * Math.pow(2, scale[Math.min(scale.length - 1, Math.max(0, (o.charge || 1) - 1))] / 12) * (o.n % 2 ? 1.5 : 1);
        tone(ac, out, "square", f, f, t, 0.07, 0.16);
        tone(ac, out, "square", f * 2, f * 2, t + 0.03, 0.05, 0.07);
      },
      score(ac, out, t) {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, out, "square", f, f, t + i * 0.075, 0.1, 0.15));
        tone(ac, out, "triangle", 130.81, 130.81, t, 0.34, 0.2);
      }
    },
    sonar: {
      hit(ac, out, t, o) {
        const f = 1180 + Math.min(4, (o.charge || 1) - 1) * 70;
        tone(ac, out, "sine", f, f * 0.985, t, 0.5, 0.26);
        tone(ac, out, "sine", f, f * 0.985, t + 0.17, 0.4, 0.08);
      },
      score(ac, out, t) {
        tone(ac, out, "sine", 280, 920, t, 0.55, 0.26);
        tone(ac, out, "sine", 1400, 1380, t + 0.5, 0.7, 0.2);
        tone(ac, out, "sine", 1400, 1380, t + 0.72, 0.5, 0.07);
      }
    },
    typewriter: {
      hit(ac, out, t, o) {
        noise(ac, out, "highpass", 2600 + (o.n % 3) * 500, t, 0.03, 0.5);
        tone(ac, out, "sine", 150, 90, t, 0.045, 0.3);
      },
      score(ac, out, t) {
        tone(ac, out, "sine", 2093, 2093, t, 0.9, 0.24);
        tone(ac, out, "sine", 4186, 4186, t, 0.5, 0.07);
        noise(ac, out, "bandpass", 1200, t + 0.16, 0.26, 0.2);       // the carriage sliding back
      }
    },
    drumkit: {
      hit(ac, out, t, o) {
        if (o.n % 2 === 0) {
          tone(ac, out, "sine", 150, 44, t, 0.18, 0.75);
          noise(ac, out, "lowpass", 900, t, 0.02, 0.2);
        } else {
          noise(ac, out, "bandpass", 1900, t, 0.14, 0.5);
          tone(ac, out, "triangle", 190, 120, t, 0.07, 0.3);
        }
      },
      score(ac, out, t) {
        tone(ac, out, "sine", 150, 40, t, 0.22, 0.8);
        noise(ac, out, "highpass", 5200, t, 0.9, 0.3);
        noise(ac, out, "bandpass", 1900, t + 0.11, 0.13, 0.4);
      }
    }
  };

  function playSound(ac, packId, kind, o) {
    const pack = SOUND_SYNTHS[packId];
    if (!ac || !pack || typeof pack[kind] !== "function") return false;
    const opts = Object.assign({ charge: 1, n: 0, volume: 1 }, o || {});
    try {
      const master = ac.createGain();
      master.gain.value = 0.55 * Math.max(0, Math.min(1.5, opts.volume));
      master.connect(ac.destination);
      pack[kind](ac, master, (Number(ac.currentTime) || 0) + 0.005, opts);
      return true;
    } catch (e) { return false; }
  }

  load();

  return {
    RARITY, ARENA_NAMES, SLOTS, SLOT_INFO, CATALOG, SETS, MASTERY_WINS,
    PADDLE_SKINS, BALL_TRAILS, BALL_SKINS, HIT_EFFECTS, SCORE_EFFECTS, DASH_EFFECTS, TELEPORT_EFFECTS,
    NET_STYLES, SCORE_DISPLAYS, COUNTDOWN_STYLES, VICTORY_EFFECTS, SOUND_PACKS, TITLES, NAMEPLATES,
    find, progressFor, isUnlocked, syncUnlocks,
    getEquipped, getSaved, equip, isNew, markSeen, countNew,
    setContext, refreshContext,
    coinItems, buy,
    masteryFor, isGilded, setTrim, recordWin, masteredCount,
    activeSet, setStatus, equipSet,
    getShuffle, setShuffle, rollShuffle,
    card, cleanCard, titleText,
    drawPaddleSkin, drawBallTrail, drawBallSkin, drawDash, createFX,
    drawNet, drawScoreboard, drawCountdown, drawNameplate, drawSetBonus, playSound,
    load, save, sanitize
  };
})();

if (typeof window !== "undefined") window.GlitchCosmetics = GlitchCosmetics;
