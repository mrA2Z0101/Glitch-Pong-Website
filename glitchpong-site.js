// Generated from the user's Glitch Pong extension build.
// Website wrapper + original game logic.

window.chrome = window.chrome || {};
window.chrome.runtime = window.chrome.runtime || {};
if (typeof window.chrome.runtime.getURL !== "function") {
  window.chrome.runtime.getURL = function getURL(path) {
    return path;
  };
}

function resolveAssetPath(path) {
  const isExtensionContext = typeof window !== "undefined" && window.location && (
    window.location.protocol === "chrome-extension:" ||
    window.location.protocol === "moz-extension:" ||
    window.location.protocol === "edge-extension:"
  );

  if (isExtensionContext &&
    typeof window.chrome !== "undefined" &&
    window.chrome.runtime &&
    typeof window.chrome.runtime.getURL === "function") {
    try {
      return window.chrome.runtime.getURL(path);
    } catch (error) {
      console.warn("Glitch Pong asset URL fallback:", error);
    }
  }

  if (typeof document !== "undefined" && document.baseURI) {
    try {
      return new URL(path, document.baseURI).href;
    } catch (error) {}
  }

  return path;
}


// ═══════════════════════════════════════════════════════════════════════════
// GLITCH PONG — XP & LEVEL PROGRESSION SYSTEM v1.0
// Persistent cyberpunk progression: levels, perks, cosmetics, match summary
// ═══════════════════════════════════════════════════════════════════════════
const GlitchProgression = (function() {

  // ─── Configuration ────────────────────────────────────────────────────────
  const CFG = {
    XP_BASE:     200,
    XP_EXPONENT: 1.5,
    MAX_LEVEL:   50,
    PERK_EVERY:  3,   // Perk choice offered every N levels
    STORAGE_KEY: "glitchPong_progression_v1"
  };

  const XP_REWARDS = {
    paddleHit:         5,
    longRally:         25,
    scorePoint:        75,
    matchVictory:      250,
    bossSurvival:      150,
    nearMiss:          20,
    dashUse:           30,
    successfulJuke:    35,
    successfulTeleport:35,
    powerupPickup:     25,
    clutchPoint:       100,
    perfectRound:      300,
    comebackWin:       200,
    noDamageBoss:      250
  };

  // All available perks
  const ALL_PERKS = [
    { id:"overclocked",  name:"OVERCLOCKED PADDLE",    desc:"Paddle speed +5%",                  stat:"paddleSpeedBonus",  val:0.05 },
    { id:"coolant",      name:"COOLANT LOOP",           desc:"Heat builds 10% slower",             stat:"heatResistance",    val:0.10 },
    { id:"dashcache",    name:"DASH CACHE",             desc:"Dash cooldown -15%",                 stat:"dashCooldownMult",  val:0.15 },
    { id:"ghostpacket",  name:"GHOST PACKET",           desc:"Teleport cooldown -15%",             stat:"teleportCooldown",  val:0.15 },
    { id:"jammer",       name:"SIGNAL JAMMER",          desc:"Juke illusion lasts longer",         stat:"jukeDuration",      val:0.15 },
    { id:"firewall",     name:"FIREWALL SHIELD",        desc:"Shield power-up is permanent×2",     stat:"shieldBonus",       val:2    },
    { id:"corruptret",   name:"CORRUPT RETURN",         desc:"First return after powerup faster",  stat:"corruptReturn",     val:0.15 },
    { id:"clutchprot",   name:"CLUTCH PROTOCOL",        desc:"Speed boost during Match Point",     stat:"clutchBoost",       val:0.08 },
    { id:"bosstrace",    name:"BOSS TRACE",             desc:"Boss projectiles glow brighter",     stat:"bossTrace",         val:1    },
    { id:"xpsurge",      name:"XP SURGE",               desc:"Gain 5% additional XP",              stat:"xpBonus",           val:0.05 },
    { id:"adaptive",     name:"ADAPTIVE KERNEL",        desc:"Reduces arena corruption effects",   stat:"adaptiveKernel",    val:0.12 },
    { id:"quantum",      name:"QUANTUM CACHE",          desc:"Occasionally duplicates power-ups",  stat:"quantumCache",      val:0.15 },
    { id:"packet",       name:"PACKET BURST",           desc:"Long rally win briefly boosts speed",stat:"packetBurst",       val:0.10 },
    { id:"emergency",    name:"EMERGENCY RESTORE",      desc:"Boss survival refreshes Dash",       stat:"emergencyRestore",  val:1    },
    { id:"mirror",       name:"MIRROR GHOST",           desc:"Teleport leaves a decoy image",      stat:"mirrorGhost",       val:1    }
  ];

  // Stat caps
  const STAT_CAPS = {
    paddleSpeedBonus: 0.15,
    heatResistance:   0.15,
    dashCooldownMult: 0.20,
    teleportCooldown: 0.20,
    xpBonus:          0.10
  };

  // Level reward titles
  const LEVEL_TITLES = [
    "NEWBIE PACKET","SIGNAL TRACE","BYTE RUNNER","HEX PILOT","GHOST USER",
    "PACKET GHOST","GLITCH RUNNER","FIREWALL BREACH","SIGNAL SURGE","BIT WARRIOR",
    "CORRUPT CODE","DARK KERNEL","CIPHER AGENT","PHASE BLADE","GHOST PROTOCOL",
    "QUANTUM TRACE","VOID PACKET","SHADOW NODE","NEXUS GHOST","SYSTEM BREACH",
    "ECHO KERNEL","DARK SIGNAL","BYTE PHANTOM","CORRUPT GHOST","GLITCH MASTER",
    "NEXUS PHANTOM","SIGNAL BREACH","QUANTUM GHOST","VOID TRACE","SYSTEM PHANTOM",
    "ECHO BREACH","DARK QUANTUM","BYTE NEXUS","CORRUPT SIGNAL","GHOST MASTER",
    "PHASE NEXUS","SHADOW BREACH","SIGNAL MASTER","QUANTUM NEXUS","VOID BREACH",
    "SYSTEM MASTER","ECHO NEXUS","DARK SIGNAL","BYTE MASTER","CORRUPT NEXUS",
    "GHOST BREACH","PHASE MASTER","SHADOW NEXUS","QUANTUM MASTER","GLITCH LORD"
  ];

  // ─── State ────────────────────────────────────────────────────────────────
  function defaultState() {
    return {
      level:          1,
      xp:             0,
      totalXP:        0,
      matchesPlayed:  0,
      wins:           0,
      losses:         0,
      currentWinStreak: 0,
      bestWinStreak:  0,
      totalPointsScored: 0,
      totalPointsAllowed: 0,
      totalRallyHits: 0,
      totalPaddleHits: 0,
      bossSurvivals:  0,
      clutchWins:     0,
      longestRally:   0,
      dashUses:       0,
      jukeUses:       0,
      teleports:      0,
      unlockedPerks:  [],
      equippedPerks:  [],
      cosmeticsUnlocked: ["default"],
      prestigeRank:   0,
      arenaStats: {
        classic:   { matches: 0, wins: 0, losses: 0 },
        matrix:    { matches: 0, wins: 0, losses: 0 },
        construct: { matches: 0, wins: 0, losses: 0 },
        blackhole: { matches: 0, wins: 0, losses: 0 }
      }
    };
  }

  let data = defaultState();
  let pendingLevelUps = [];        // queue of levels to process
  let pendingPerkChoices = [];     // queued levels that grant perk selection
  let sessionMatchXP = 0;         // XP earned this match
  let sessionMatchBreakdown = {};  // { reason: total }

  // ─── Persistence ──────────────────────────────────────────────────────────
  function load() {
    try {
      const raw = localStorage.getItem(CFG.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data = Object.assign(defaultState(), parsed);
        const defaults = defaultState().arenaStats;
        data.arenaStats = Object.assign({}, defaults, parsed.arenaStats || {});
        Object.keys(defaults).forEach(id => {
          data.arenaStats[id] = Object.assign({}, defaults[id], data.arenaStats[id] || {});
        });
      }
    } catch(e) {}
  }

  function save() {
    try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
  }

  function reset() {
    data = defaultState();
    pendingLevelUps = [];
    pendingPerkChoices = [];
    save();
  }

  // ─── XP Calculation ───────────────────────────────────────────────────────
  function xpForLevel(lvl) {
    return Math.floor(CFG.XP_BASE * Math.pow(Math.max(1, lvl), CFG.XP_EXPONENT));
  }

  function xpToNext() { return xpForLevel(data.level); }

  function xpProgress() { return Math.min(1, data.xp / xpToNext()); }

  // Returns [earned, reason] pairs queued for floating display
  const _xpQueue = [];

  function addXP(amount, reason) {
    if (amount <= 0) return;
    const bonus = 1 + getPerkStat("xpBonus");
    const actual = Math.round(amount * bonus);
    data.xp += actual;
    data.totalXP += actual;
    sessionMatchXP += actual;
    sessionMatchBreakdown[reason] = (sessionMatchBreakdown[reason] || 0) + actual;
    _xpQueue.push({ amount: actual, reason });
    checkLevelUp();
    save();
    return actual;
  }

  function checkLevelUp() {
    while (data.level < CFG.MAX_LEVEL && data.xp >= xpForLevel(data.level)) {
      data.xp -= xpForLevel(data.level);
      data.level++;
      pendingLevelUps.push(data.level);
      if (data.level % CFG.PERK_EVERY === 0) {
        pendingPerkChoices.push(data.level);
      }
    }
  }

  // ─── Perk Helpers ─────────────────────────────────────────────────────────
  function getRandomPerks(count = 3) {
    const available = ALL_PERKS.filter(p => !data.equippedPerks.includes(p.id));
    const shuffled = available.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  function equipPerk(perkId) {
    if (!data.equippedPerks.includes(perkId)) {
      data.equippedPerks.push(perkId);
      if (!data.unlockedPerks.includes(perkId)) data.unlockedPerks.push(perkId);
      save();
    }
  }

  function getPerkStat(statName) {
    let total = 0;
    data.equippedPerks.forEach(id => {
      const perk = ALL_PERKS.find(p => p.id === id);
      if (perk && perk.stat === statName) {
        total += perk.val;
      }
    });
    if (STAT_CAPS[statName] !== undefined) total = Math.min(total, STAT_CAPS[statName]);
    return total;
  }

  function hasPerk(perkId) { return data.equippedPerks.includes(perkId); }

  // ─── Session Tracking ─────────────────────────────────────────────────────
  function beginMatch() {
    sessionMatchXP = 0;
    sessionMatchBreakdown = {};
  }

  function endMatch(isWin, isClutch, context = {}) {
    data.matchesPlayed++;
    if (isWin) {
      data.wins++;
      data.currentWinStreak++;
      data.bestWinStreak = Math.max(data.bestWinStreak, data.currentWinStreak);
    } else {
      data.losses++;
      data.currentWinStreak = 0;
    }
    if (isClutch) data.clutchWins++;
    const arenaId = context.arenaId || "classic";
    if (!data.arenaStats[arenaId]) data.arenaStats[arenaId] = { matches: 0, wins: 0, losses: 0 };
    const arena = data.arenaStats[arenaId];
    arena.matches++;
    if (isWin) arena.wins++; else arena.losses++;
    data.totalPointsScored += Math.max(0, Number(context.playerScore) || 0);
    data.totalPointsAllowed += Math.max(0, Number(context.opponentScore) || 0);
    save();
    return { totalXP: sessionMatchXP, breakdown: sessionMatchBreakdown };
  }

  function trackRally(hits) {
    data.totalPaddleHits++;
    if (hits > data.longestRally) data.longestRally = hits;
    save();
  }

  function trackBossSurvival() { data.bossSurvivals++; save(); }
  function trackDash()         { data.dashUses++;       }
  function trackJuke()         { data.jukeUses++;       }
  function trackTeleport()     { data.teleports++;      }

  // ─── Public API ───────────────────────────────────────────────────────────
  load(); // auto-load on module init

  return {
    get data()            { return data;                    },
    get level()           { return data.level;              },
    get xp()              { return data.xp;                 },
    get xpQueue()         { return _xpQueue;                },
    get pendingLevelUps() { return pendingLevelUps;         },
    get pendingPerkChoices() { return pendingPerkChoices;   },
    xpToNext, xpProgress, xpForLevel,
    addXP, checkLevelUp,
    getRandomPerks, equipPerk, getPerkStat, hasPerk,
    beginMatch, endMatch, trackRally, trackBossSurvival,
    trackDash, trackJuke, trackTeleport,
    save, load, reset,
    XP_REWARDS, ALL_PERKS, LEVEL_TITLES,
    getTitle: (lvl) => LEVEL_TITLES[Math.min(lvl - 1, LEVEL_TITLES.length - 1)] || "GLITCH LORD",
    drainXPQueue: () => _xpQueue.splice(0),
    drainLevelUps: () => pendingLevelUps.splice(0),
    drainPerkChoices: () => pendingPerkChoices.splice(0)
  };
})();


function injectGameById(gameId, options = {}) {
  const glitchFx = !!options.glitchFx;
  const safetyMode = !!options.safetyMode;


  function commonTransition() {
    return new Promise((resolve) => {
      const oldVeil = document.getElementById("__glitchcade_transition");
      if (oldVeil) oldVeil.remove();
      const oldStyle = document.getElementById("__glitchcade_transition_style");
      if (oldStyle) oldStyle.remove();

      const style = document.createElement("style");
      style.id = "__glitchcade_transition_style";
      style.textContent = `
        @keyframes gcSiteCorrupt {
          0% { opacity: 0; transform: scale(1) translateX(0); filter: blur(0px) saturate(1) hue-rotate(0deg); }
          8% { opacity: 1; transform: scale(1.03) translateX(-10px); filter: blur(1.4px) saturate(1.45) hue-rotate(-12deg); }
          16% { opacity: .55; transform: scale(.992) translateX(14px); filter: blur(.2px) saturate(1.15) hue-rotate(8deg); }
          28% { opacity: .95; transform: scale(1.026) translateX(-8px); filter: blur(2px) saturate(1.55) hue-rotate(-18deg); }
          42% { opacity: .66; transform: scale(1.01) translateX(9px); filter: blur(.8px) saturate(1.28) hue-rotate(10deg); }
          58% { opacity: .86; transform: scale(1.018) translateX(-6px); filter: blur(1.2px) saturate(1.42) hue-rotate(-10deg); }
          78% { opacity: .34; transform: scale(1.006) translateX(4px); filter: blur(.4px) saturate(1.08) hue-rotate(6deg); }
          100% { opacity: 0; transform: scale(1) translateX(0); filter: blur(0px) saturate(1) hue-rotate(0deg); }
        }
        @keyframes gcScanSweep {
          0% { transform: translateY(-120%); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(120%); opacity: 0; }
        }
        @keyframes gcChromaticShake {
          0%,100% { transform: translateX(0); }
          16% { transform: translateX(-8px); }
          32% { transform: translateX(10px); }
          48% { transform: translateX(-6px); }
          64% { transform: translateX(8px); }
          80% { transform: translateX(-4px); }
        }
        @keyframes gcSliceTravel {
          0% { transform: translateX(-12%) skewX(-14deg); opacity: 0; }
          18% { opacity: .95; }
          100% { transform: translateX(18%) skewX(10deg); opacity: 0; }
        }
        @keyframes gcNoiseFlicker {
          0%,100% { opacity: 0; }
          10% { opacity: .18; }
          11% { opacity: .02; }
          20% { opacity: .22; }
          21% { opacity: 0; }
          48% { opacity: .12; }
          49% { opacity: .01; }
          70% { opacity: .18; }
          71% { opacity: .03; }
        }
      `;
      document.documentElement.appendChild(style);

      const veil = document.createElement("div");
      veil.id = "__glitchcade_transition";
      veil.style.cssText = [
        "position:fixed","inset:0","z-index:2147483645","pointer-events:none","overflow:hidden",
        "background:linear-gradient(180deg, rgba(3,8,20,.28), rgba(3,8,20,.64), rgba(3,8,20,.24))",
        "animation:gcSiteCorrupt .96s cubic-bezier(.22,.61,.36,1) forwards"
      ].join(";");

      const lines = document.createElement("div");
      lines.style.cssText = [
        "position:absolute","inset:-10%","mix-blend-mode:screen",
        "background:repeating-linear-gradient(180deg, rgba(255,255,255,0) 0 5px, rgba(86,224,255,.10) 5px 6px, rgba(255,79,216,.07) 6px 7px, transparent 7px 12px)",
        "opacity:.9"
      ].join(";");
      veil.appendChild(lines);

      const noise = document.createElement("div");
      noise.style.cssText = [
        "position:absolute","inset:0","mix-blend-mode:screen","opacity:0",
        "background:repeating-linear-gradient(90deg, rgba(255,255,255,.06) 0 1px, transparent 1px 3px), repeating-linear-gradient(180deg, rgba(255,255,255,.04) 0 1px, transparent 1px 4px)",
        "animation:gcNoiseFlicker .96s linear forwards"
      ].join(";");
      veil.appendChild(noise);

      const sweep = document.createElement("div");
      sweep.style.cssText = [
        "position:absolute","left:0","right:0","height:36%","top:-40%",
        "background:linear-gradient(180deg, rgba(255,255,255,0), rgba(86,224,255,.25), rgba(255,79,216,.16), rgba(255,255,255,0))",
        "filter:blur(10px)","animation:gcScanSweep .92s ease forwards"
      ].join(";");
      veil.appendChild(sweep);

      const rgb = document.createElement("div");
      rgb.style.cssText = [
        "position:absolute","inset:0","mix-blend-mode:screen","opacity:.82",
        "background:linear-gradient(90deg, transparent 0 8%, rgba(255,79,216,.16) 8% 13%, transparent 13% 44%, rgba(86,224,255,.16) 44% 49%, transparent 49% 77%, rgba(255,79,216,.13) 77% 80%, transparent 80% 100%)",
        "animation:gcChromaticShake .18s steps(2,end) infinite"
      ].join(";");
      veil.appendChild(rgb);

      for (let i = 0; i < 10; i++) {
        const slice = document.createElement("div");
        const top = Math.random() * 100;
        const h = 5 + Math.random() * 14;
        slice.style.cssText = [
          "position:absolute",
          "left:-10%",
          `top:${top}%`,
          "width:120%",
          `height:${h}px`,
          "background:linear-gradient(90deg, transparent, rgba(103,239,255,.44), rgba(255,79,216,.38), transparent)",
          "mix-blend-mode:screen",
          "filter:blur(.6px)",
          `animation:gcSliceTravel ${0.18 + Math.random() * 0.18}s steps(3,end) ${i * 0.04}s forwards`
        ].join(";");
        veil.appendChild(slice);
      }

      document.documentElement.appendChild(veil);

      const root = document.documentElement;
      const body = document.body;
      const prevRootAnim = root.style.animation;
      const prevRootFilter = root.style.filter;
      const prevBodyTransform = body ? body.style.transform : "";
      root.style.animation = "gcChromaticShake .12s steps(2,end) 8";
      root.style.filter = "contrast(1.2) saturate(1.25)";
      if (body) body.style.transform = "translateX(-4px)";

      setTimeout(() => {
        root.style.animation = prevRootAnim;
        root.style.filter = prevRootFilter;
        if (body) body.style.transform = prevBodyTransform;
        veil.remove();
        style.remove();
        resolve();
      }, glitchFx ? 980 : 0);
    });
  }


  function installBaseShell(title, helpText) {
    if (window.__glitchcadeCleanup) {
      try { window.__glitchcadeCleanup(); } catch (e) { console.error(e); }
    }

    const d = document;
    const w = window;
    const state = { raf: null, timers: [], listeners: [] };

    const overlay = d.createElement("div");
    overlay.id = "__glitchcade_overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;overflow:hidden;overscroll-behavior:none;touch-action:none;background:rgba(4,8,18,0.10);";

    const canvas = d.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;user-select:none;-webkit-user-select:none;";
    overlay.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const _hudMobile = (navigator.maxTouchPoints > 0 || 'ontouchstart' in w) && w.innerWidth < 1200;

    const hud = d.createElement("div");
    hud.id = "gp-game-hud";
    hud.style.cssText = [
      "position:absolute","top:max(8px, env(safe-area-inset-top))","left:50%","transform:translateX(-50%)",
      _hudMobile ? "padding:5px 10px" : "padding:10px 18px",
      "border-radius:10px","background:rgba(7,14,30,0.88)",
      "border:1px solid rgba(90,220,255,0.22)","color:#e8fbff",
      _hudMobile ? "font:600 9px monospace" : "font:700 14px monospace",
      "letter-spacing:.04em","text-align:center",
      _hudMobile ? "max-width:96vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" : "min-width:420px",
      "box-shadow:0 0 24px rgba(90,220,255,0.12)"
    ].join(";");
    overlay.appendChild(hud);
    hud.style.display = "none";

    const help = d.createElement("div");
    help.style.cssText = [
      "position:absolute","bottom:16px","left:50%","transform:translateX(-50%)",
      "padding:8px 14px","border-radius:999px","background:rgba(7,14,30,0.78)",
      "border:1px solid rgba(90,220,255,0.18)","color:#9fc8d6","font:12px monospace"
    ].join(";");
    // On mobile, keyboard shortcut hints are useless — hide entirely.
    if (!_hudMobile) help.textContent = helpText + " // Esc quit // R restart";
    overlay.appendChild(help);
    help.style.display = "none";

    const closeBtn = d.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = [
      "position:absolute","top:max(16px, env(safe-area-inset-top))","right:max(16px, env(safe-area-inset-right))","width:40px","height:40px","border-radius:999px",
      "border:1px solid rgba(113,239,255,0.22)","background:rgba(6,10,18,0.44)",
      "backdrop-filter:blur(6px)","color:#dffcff","font:700 18px monospace","cursor:pointer","pointer-events:auto",
      "box-shadow:0 0 16px rgba(113,239,255,0.08)"
    ].join(";");
    overlay.appendChild(closeBtn);

    function sizeCanvas() {
      const viewport = w.visualViewport;
      const nextWidth = Math.max(1, Math.round(viewport ? viewport.width : w.innerWidth));
      const nextHeight = Math.max(1, Math.round(viewport ? viewport.height : w.innerHeight));
      if (viewport) {
        overlay.style.inset = "auto";
        overlay.style.left = `${Math.round(viewport.offsetLeft || 0)}px`;
        overlay.style.top = `${Math.round(viewport.offsetTop || 0)}px`;
        overlay.style.width = `${nextWidth}px`;
        overlay.style.height = `${nextHeight}px`;
      }
      // Assigning canvas dimensions clears it, so avoid doing that during the
      // duplicate resize events mobile browsers fire while toolbars animate.
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
    }
    sizeCanvas();

    function addListener(target, event, handler, options) {
      target.addEventListener(event, handler, options);
      state.listeners.push(() => target.removeEventListener(event, handler, options));
    }

    function addTimer(id) { state.timers.push(id); }

    function updateHUD(text) { hud.innerHTML = text; }

    const previousOverflow = d.documentElement.style.overflow;
    const previousBodyOverflow = d.body ? d.body.style.overflow : "";
    const previousScrollBehavior = d.documentElement.style.scrollBehavior;

    function stopInteraction(event) {
      if (overlay.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    function stopKeys(event) {
      const blockedKeys = new Set([
        " ",
        "Spacebar",
        "Space",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Tab"
      ]);

      if (blockedKeys.has(event.key) || blockedKeys.has(event.code)) {
        event.preventDefault();
      }
    }

    d.documentElement.style.overflow = "hidden";
    d.documentElement.style.scrollBehavior = "auto";
    if (d.body) d.body.style.overflow = "hidden";

    d.documentElement.appendChild(overlay);

    addListener(closeBtn, "click", clearScene, true);
    addListener(window, "resize", sizeCanvas, true);
    if (window.visualViewport) {
      addListener(window.visualViewport, "resize", sizeCanvas, true);
      addListener(window.visualViewport, "scroll", sizeCanvas, true);
    }

    addListener(d, "click", stopInteraction, true);
    addListener(d, "dblclick", stopInteraction, true);
    addListener(d, "mousedown", stopInteraction, true);
    addListener(d, "mouseup", stopInteraction, true);
    addListener(d, "contextmenu", stopInteraction, true);
    addListener(d, "pointerdown", stopInteraction, true);
    addListener(d, "touchstart", stopInteraction, true);
    addListener(d, "dragstart", stopInteraction, true);
    addListener(d, "selectstart", stopInteraction, true);
    addListener(w, "wheel", stopInteraction, { capture: true, passive: false });
    addListener(w, "keydown", stopKeys, true);

    function clearScene() {
      if (state.raf) cancelAnimationFrame(state.raf);
      state.timers.forEach(clearTimeout);
      state.listeners.forEach((off) => off());
      d.documentElement.style.overflow = previousOverflow;
      d.documentElement.style.scrollBehavior = previousScrollBehavior;
      if (d.body) d.body.style.overflow = previousBodyOverflow;
      try { overlay.remove(); } catch (e) {}
      const style = document.getElementById("__gc_game_style");
      if (style) style.remove();
      window.__glitchcadeCleanup = null;
    }

    window.__glitchcadeCleanup = clearScene;

    return { d, w, overlay, canvas, ctx, hud, help, closeBtn, updateHUD, clearScene, state, addListener, addTimer, sizeCanvas, title };
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }











  function startDodgeGrid() {
    const shell = installBaseShell("DODGE GRID", "DODGE GRID // WASD or mouse // Survive");
    const { d, w, overlay, canvas, ctx, updateHUD, state, addListener } = shell;

    overlay.style.pointerEvents = "auto";
    canvas.style.pointerEvents = "auto";

    const previousBodyCursor = d.body ? d.body.style.cursor : "";
    if (d.body) d.body.style.cursor = "none";
    state.listeners.push(() => { if (d.body) d.body.style.cursor = previousBodyCursor; });

    const style = d.createElement("style");
    style.id = "__gc_game_style";
    style.textContent = `html, body, * { cursor: none !important; }`;
    d.documentElement.appendChild(style);

    let player = { x: canvas.width * 0.5, y: canvas.height * 0.7, size: 18 };
    let useMouse = false;
    let keys = { w:false, a:false, s:false, d:false, up:false, left:false, down:false, right:false, shiftLeft:false, shiftRight:false };
    let obstacles = [];
    let particles = [];
    let arenaTime = 0;
    let survivalFrames = 0;
    let scoreMultiplier = 1;
    let difficulty = 1;
    let spawnTimer = 0;
    let glitchPulse = 0;
    let screenShake = 0;
    let alive = true;
    let nearMissFrames = 0;

    function snapshotDomHazards() {
      const interestingEls = Array.from(d.querySelectorAll("img, button, a, input, textarea, h1, h2, h3, p, div"))
        .filter((el) => {
          try {
            const r = el.getBoundingClientRect();
            const cs = w.getComputedStyle(el);
            return (
              cs.display !== "none" &&
              cs.visibility !== "hidden" &&
              r.width > 24 &&
              r.height > 16 &&
              r.width < 340 &&
              r.height < 220
            );
          } catch {
            return false;
          }
        })
        .slice(0, 36);

      return interestingEls.map((el) => {
        let label = "";
        let rect = { width: 48, height: 24 };
        try {
          rect = el.getBoundingClientRect();
          label = (el.innerText || el.value || el.alt || el.getAttribute("aria-label") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 12);
        } catch {}
        const tag = (el.tagName || "DIV").toUpperCase();
        let kind = "dom";
        if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "TEXTAREA") kind = "button";
        else if (tag === "IMG") kind = "image";
        return {
          w: Math.min(120, Math.max(34, rect.width * 0.22)),
          h: Math.min(58, Math.max(18, rect.height * 0.22)),
          text: label || tag,
          kind
        };
      });
    }

    let domRects = snapshotDomHazards();

    function rand(min, max) { return Math.random() * (max - min) + min; }
    function pick(arr, fallback) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback; }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function updateHUDText() {
      const secs = (survivalFrames / 60).toFixed(1);
      updateHUD(
        `DODGE GRID // TIME: <span style="color:#7ef9ff">${secs}s</span> // ` +
        `DIFF: <span style="color:#ff8feb">${difficulty.toFixed(1)}</span> // ` +
        `MULTI: <span style="color:#ffd27a">x${scoreMultiplier.toFixed(1)}</span>`
      );
    }

    function addParticleBurst(x, y, color1, color2, count=16) {
      for (let i = 0; i < count; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(1.5, 5.5);
        const life = rand(12, 26);
        particles.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life, maxLife: life,
          size: rand(2, 5),
          color: i % 2 ? color1 : color2
        });
      }
    }

    function createHazard(type) {
      const speedScale = 2.2 + difficulty * 0.45;

      if (type === "square-stream") {
        const size = rand(18, 34);
        const y = rand(90, canvas.height - 90);
        const fromLeft = Math.random() > 0.5;
        obstacles.push({
          type,
          x: fromLeft ? -80 : canvas.width + 80,
          y,
          w: size,
          h: size,
          vx: fromLeft ? rand(speedScale, speedScale + 2.5) : -rand(speedScale, speedScale + 2.5),
          vy: 0,
          hue: "cyan",
          life: 0
        });
      } else if (type === "diagonal") {
        const size = rand(18, 34);
        const fromLeft = Math.random() > 0.5;
        obstacles.push({
          type,
          x: fromLeft ? -40 : canvas.width + 40,
          y: rand(120, canvas.height - 120),
          w: size,
          h: size,
          vx: fromLeft ? rand(speedScale, speedScale + 1.8) : -rand(speedScale, speedScale + 1.8),
          vy: rand(-1.8, 1.8),
          hue: "pink",
          life: 0,
          rot: rand(0, Math.PI * 2)
        });
      } else if (type === "grid-burst") {
        const cols = 5 + Math.floor(difficulty * 0.3);
        const gap = 42;
        const startX = rand(80, Math.max(100, canvas.width - 80 - cols * gap));
        const fromTop = Math.random() > 0.5;
        for (let i = 0; i < cols; i++) {
          obstacles.push({
            type,
            x: startX + i * gap,
            y: fromTop ? -30 - i * 6 : canvas.height + 30 + i * 6,
            w: 24,
            h: 24,
            vx: rand(-0.25, 0.25),
            vy: fromTop ? rand(speedScale, speedScale + 1.5) : -rand(speedScale, speedScale + 1.5),
            hue: i % 2 ? "cyan" : "pink",
            life: 0
          });
        }
      } else if (type === "dom-frag") {
        const frag = pick(domRects, { w: rand(42, 90), h: rand(18, 34), text: "DOM", kind: "dom" });
        const fromLeft = Math.random() > 0.5;
        obstacles.push({
          type,
          x: fromLeft ? -frag.w - 20 : canvas.width + frag.w + 20,
          y: rand(100, canvas.height - 120),
          w: frag.w,
          h: frag.h,
          vx: fromLeft ? rand(speedScale - 0.5, speedScale + 1.8) : -rand(speedScale - 0.5, speedScale + 1.8),
          vy: rand(-0.8, 0.8),
          hue: frag.kind === "button" ? "amber" : (frag.kind === "image" ? "pink" : "amber"),
          life: 0,
          text: frag.text || "DOM",
          rot: rand(-0.35, 0.35),
          kind: frag.kind || "dom"
        });
      } else if (type === "glitch-path") {
        const count = 7;
        const startY = rand(110, canvas.height - 110);
        const fromLeft = Math.random() > 0.5;
        for (let i = 0; i < count; i++) {
          obstacles.push({
            type,
            x: fromLeft ? -40 - i * 26 : canvas.width + 40 + i * 26,
            y: startY + Math.sin(i * 0.9) * 52,
            w: 18,
            h: 18,
            vx: fromLeft ? rand(speedScale + 0.8, speedScale + 2.2) : -rand(speedScale + 0.8, speedScale + 2.2),
            vy: Math.cos(i * 0.7) * 0.5,
            hue: i % 2 ? "cyan" : "pink",
            life: i * 8
          });
        }
      }
    }

    function spawnWave() {
      const types = ["square-stream", "diagonal", "grid-burst", "dom-frag", "glitch-path"];
      createHazard(pick(types, "square-stream"));
      if (difficulty > 2.4 && Math.random() > 0.55) createHazard(pick(types, "diagonal"));
      if (difficulty > 3.2 && Math.random() > 0.6) createHazard("dom-frag");
    }

    function playerMove() {
      const speed = 6.2;
      if (!useMouse) {
        if (keys.w || keys.up) player.y -= speed;
        if (keys.s || keys.down) player.y += speed;
        if (keys.a || keys.left) player.x -= speed;
        if (keys.d || keys.right) player.x += speed;
      }
      player.x = clamp(player.x, 18, canvas.width - 18);
      player.y = clamp(player.y, 86, canvas.height - 18);
    }

    addListener(overlay, "mousemove", (e) => {
      useMouse = true;
      player.x = e.clientX;
      player.y = e.clientY;
    }, true);

    addListener(d, "keydown", (e) => {
      if (e.key === "Escape") window.__glitchcadeCleanup && window.__glitchcadeCleanup();
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        resetGame();
      }
      if (e.key === "w" || e.key === "W") { keys.w = true; useMouse = false; }
      if (e.key === "a" || e.key === "A") { keys.a = true; useMouse = false; }
      if (e.key === "s" || e.key === "S") { keys.s = true; useMouse = false; }
      if (e.key === "d" || e.key === "D") { keys.d = true; useMouse = false; }
      if (e.key === "ArrowUp") { keys.up = true; useMouse = false; }
      if (e.key === "ArrowLeft") { keys.left = true; useMouse = false; }
      if (e.key === "ArrowDown") { keys.down = true; useMouse = false; }
      if (e.key === "ArrowRight") { keys.right = true; useMouse = false; }
    }, true);

    addListener(d, "keyup", (e) => {
      if (e.key === "w" || e.key === "W") keys.w = false;
      if (e.key === "a" || e.key === "A") keys.a = false;
      if (e.key === "s" || e.key === "S") keys.s = false;
      if (e.key === "d" || e.key === "D") keys.d = false;
      if (e.key === "ArrowUp") keys.up = false;
      if (e.key === "ArrowLeft") keys.left = false;
      if (e.key === "ArrowDown") keys.down = false;
      if (e.key === "ArrowRight") keys.right = false;
    }, true);

    function collides(o) {
      const half = player.size * 0.5;
      return !(
        player.x + half < o.x ||
        player.x - half > o.x + o.w ||
        player.y + half < o.y ||
        player.y - half > o.y + o.h
      );
    }

    function nearMiss(o) {
      const pad = 18;
      const half = player.size * 0.5;
      return !(
        player.x + half + pad < o.x ||
        player.x - half - pad > o.x + o.w ||
        player.y + half + pad < o.y ||
        player.y - half - pad > o.y + o.h
      );
    }

    function drawBackground() {
      const jitterX = screenShake > 0 ? rand(-5, 5) : 0;
      const jitterY = screenShake > 0 ? rand(-3, 3) : 0;
      ctx.save();
      ctx.translate(jitterX, jitterY);

      ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);
      ctx.fillStyle = "rgba(4,8,18,0.14)";
      ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

      for (let y = 0; y < canvas.height; y += 5) {
        ctx.fillStyle = "rgba(255,255,255,0.022)";
        ctx.fillRect(0, y, canvas.width, 1);
      }

      if (glitchPulse > 0) {
        const a = Math.min(0.22, glitchPulse / 100);
        for (let i = 0; i < 6; i++) {
          const gy = (arenaTime * 11 + i * 63) % canvas.height;
          ctx.fillStyle = `rgba(103,239,255,${a})`;
          ctx.fillRect(0, gy, canvas.width, 3);
          ctx.fillStyle = `rgba(255,79,216,${a * 0.95})`;
          ctx.fillRect(0, gy + 4, canvas.width, 2);
        }
      }

      ctx.restore();
    }

    function drawObstacle(o) {
      ctx.save();
      if (o.rot) {
        ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
        ctx.rotate(o.rot + Math.sin(o.life * 0.08) * 0.08);
        ctx.translate(-o.w / 2, -o.h / 2);
      } else {
        ctx.translate(o.x, o.y);
      }

      if (o.hue === "cyan") {
        ctx.shadowColor = "rgba(103,239,255,0.9)";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "rgba(18,110,138,0.72)";
        ctx.strokeStyle = "rgba(103,239,255,0.95)";
      } else if (o.hue === "pink") {
        ctx.shadowColor = "rgba(255,79,216,0.9)";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "rgba(128,24,88,0.70)";
        ctx.strokeStyle = "rgba(255,79,216,0.95)";
      } else {
        ctx.shadowColor = "rgba(255,210,122,0.8)";
        ctx.shadowBlur = 16;
        ctx.fillStyle = "rgba(132,92,24,0.72)";
        ctx.strokeStyle = "rgba(255,210,122,0.95)";
      }

      if (o.kind === "button") {
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(0, 0, o.w, o.h, 8);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillRect(0, 0, o.w, o.h);
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, o.w, o.h);
        }
      } else {
        ctx.fillRect(0, 0, o.w, o.h);
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, o.w, o.h);
      }

      if (o.text) {
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(o.text, o.w / 2, o.h / 2 + 3);
      }

      ctx.restore();
    }

    function drawPlayer() {
      ctx.save();
      const px = player.x - player.size / 2;
      const py = player.y - player.size / 2;
      ctx.shadowColor = nearMissFrames > 0 ? "rgba(255,210,122,0.95)" : "rgba(103,239,255,0.95)";
      ctx.shadowBlur = 28;

      ctx.fillStyle = nearMissFrames > 0 ? "rgba(255,210,122,0.98)" : "rgba(103,239,255,0.98)";
      ctx.fillRect(px, py, player.size, player.size);

      ctx.strokeStyle = "rgba(255,79,216,0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, player.size, player.size);

      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(player.x - 10, player.y);
      ctx.lineTo(player.x + 10, player.y);
      ctx.moveTo(player.x, player.y - 10);
      ctx.lineTo(player.x, player.y + 10);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = "rgba(103,239,255,0.28)";
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(player.x - 2 - i * 7, player.y - 2 + Math.sin((arenaTime + i) * 0.25) * 2, 4, 4);
      }
      ctx.restore();
    }

    function drawParticles() {
      for (const p of particles) {
        const a = clamp(p.life / p.maxLife, 0, 1);
        const color = p.color.replace("0.95", a.toFixed(2)).replace("0.9", a.toFixed(2));
        ctx.fillStyle = color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }

    function renderGameOver() {
      drawBackground();
      obstacles.forEach(drawObstacle);
      drawParticles();

      ctx.fillStyle = "rgba(0,0,0,0.48)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#eef7ff";
      ctx.font = "bold 48px monospace";
      ctx.textAlign = "center";
      ctx.fillText("DODGE GRID", canvas.width / 2, canvas.height / 2 - 50);
      ctx.fillStyle = "#ff8feb";
      ctx.font = "bold 22px monospace";
      ctx.fillText("SYSTEM COLLAPSE", canvas.width / 2, canvas.height / 2 - 8);
      ctx.fillStyle = "#7ef9ff";
      ctx.font = "bold 16px monospace";
      ctx.fillText(`TIME ${(survivalFrames / 60).toFixed(1)}s   //   MULTI x${scoreMultiplier.toFixed(1)}`, canvas.width / 2, canvas.height / 2 + 28);
      ctx.fillStyle = "#ffd27a";
      ctx.fillText("PRESS R TO RESTART", canvas.width / 2, canvas.height / 2 + 64);
    }

    function resetGame() {
      player.x = canvas.width * 0.5;
      player.y = canvas.height * 0.7;
      obstacles = [];
      particles = [];
      arenaTime = 0;
      survivalFrames = 0;
      scoreMultiplier = 1;
      difficulty = 1;
      spawnTimer = 0;
      glitchPulse = 0;
      screenShake = 0;
      nearMissFrames = 0;
      alive = true;
      domRects = snapshotDomHazards();
      for (let i = 0; i < 4; i++) spawnWave();
      updateHUDText();
    }

    function loop() {
      if (!alive) {
        renderGameOver();
        state.raf = requestAnimationFrame(loop);
        return;
      }

      arenaTime += 1;
      survivalFrames += 1;
      difficulty = 1 + survivalFrames / 600;
      scoreMultiplier = 1 + survivalFrames / 900;
      spawnTimer -= 1;
      if (glitchPulse > 0) glitchPulse -= 1;
      if (screenShake > 0) screenShake -= 1;
      if (nearMissFrames > 0) nearMissFrames -= 1;

      playerMove();

      if (spawnTimer <= 0) {
        spawnWave();
        spawnTimer = Math.max(10, 36 - Math.floor(difficulty * 3));
        glitchPulse = Math.min(20, glitchPulse + 6);
      }

      let nearMissFound = false;

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.life += 1;
        o.x += o.vx;
        o.y += o.vy;

        if (o.type === "glitch-path") {
          o.y += Math.sin((o.life + i * 11) * 0.15) * 1.2;
        }

        if (
          o.x > canvas.width + 200 || o.x + o.w < -200 ||
          o.y > canvas.height + 200 || o.y + o.h < -200
        ) {
          obstacles.splice(i, 1);
          continue;
        }

        if (collides(o)) {
          alive = false;
          screenShake = 18;
          glitchPulse = 30;
          addParticleBurst(player.x, player.y, "rgba(103,239,255,0.95)", "rgba(255,79,216,0.95)", 30);
        } else if (nearMiss(o)) {
          nearMissFound = true;
        }
      }

      if (nearMissFound) {
        nearMissFrames = 6;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.life -= 1;
        if (p.life <= 0) particles.splice(i, 1);
      }

      drawBackground();
      obstacles.forEach(drawObstacle);
      drawParticles();
      drawPlayer();

      updateHUDText();
      state.raf = requestAnimationFrame(loop);
    }

    resetGame();
    loop();
  }


  function startCursorArena() {
    const shell = installBaseShell("CURSOR ARENA", "CURSOR ARENA // Mouse aim // Click shoot");
    const { d, w, overlay, canvas, ctx, updateHUD, state, addListener } = shell;

    const previousBodyCursor = d.body ? d.body.style.cursor : "";
    if (d.body) d.body.style.cursor = "none";
    state.listeners.push(() => { if (d.body) d.body.style.cursor = previousBodyCursor; });

    const style = d.createElement("style");
    style.id = "__gc_game_style";
    style.textContent = `html, body, * { cursor: none !important; }`;
    d.documentElement.appendChild(style);

    overlay.style.pointerEvents = "auto";
    canvas.style.pointerEvents = "auto";

    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;
    let score = 0;
    let shots = 0;
    let hits = 0;
    let combo = 0;
    let comboTimer = 0;
    let glitchPulse = 0;
    let missPulse = 0;
    let spawnTimer = 0;
    let arenaTime = 0;
    let targetSpeedScale = 1;
    let shakeFrames = 0;

    const targets = [];
    const particles = [];
    const ripples = [];
    const shotsFx = [];

    function rand(min, max) { return Math.random() * (max - min) + min; }
    function clamp01(v) { return Math.max(0, Math.min(1, v)); }
    function accuracy() { return shots ? Math.round((hits / shots) * 100) : 100; }

    function updateHudText() {
      updateHUD(
        `CURSOR ARENA // SCORE: <span style="color:#7ef9ff">${score}</span> // ` +
        `COMBO: <span style="color:#ff8feb">x${combo}</span> // ` +
        `ACC: <span style="color:#ffd27a">${accuracy()}%</span>`
      );
    }

    function spawnTarget() {
      const radius = rand(16, 28);
      const pad = 60;
      const x = rand(pad + radius, canvas.width - pad - radius);
      const y = rand(90 + radius, canvas.height - 90 - radius);
      const drift = rand(0.3, 1.2) * targetSpeedScale;
      targets.push({
        x, y, radius,
        vx: rand(-drift, drift),
        vy: rand(-drift, drift),
        phase: rand(0, Math.PI * 2),
        life: 0,
        hue: Math.random() > 0.5 ? "cyan" : "pink",
        hp: radius > 22 ? 2 : 1
      });
    }

    function addBurst(x, y, colorA, colorB) {
      for (let i = 0; i < 18; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(1.5, 6.5);
        const life = rand(16, 30);
        particles.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life,
          maxLife: life,
          color: i % 2 ? colorA : colorB,
          size: rand(1.5, 4.2)
        });
      }
      ripples.push({ x, y, r: 8, life: 18, maxLife: 18 });
    }

    function fireShot() {
      shots += 1;
      shotsFx.push({ x: mouseX, y: mouseY, life: 8 });

      let best = null;
      let bestDist = Infinity;
      for (const t of targets) {
        const dx = mouseX - t.x;
        const dy = mouseY - t.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= t.radius + 10 && dist < bestDist) {
          best = t;
          bestDist = dist;
        }
      }

      if (best) {
        hits += 1;
        combo += 1;
        comboTimer = 90;
        glitchPulse = 18 + Math.min(combo * 2, 26);
        best.hp -= 1;
        addBurst(best.x, best.y, "rgba(103,239,255,0.95)", "rgba(255,79,216,0.95)");

        if (best.hp <= 0) {
          const idx = targets.indexOf(best);
          if (idx >= 0) targets.splice(idx, 1);
          score += 100 + (combo - 1) * 20;
        } else {
          score += 35 + combo * 5;
        }
      } else {
        combo = 0;
        comboTimer = 0;
        missPulse = 18;
        glitchPulse = 10;
        shakeFrames = 8;
      }

      updateHudText();
    }

    function resetArena() {
      score = 0;
      shots = 0;
      hits = 0;
      combo = 0;
      comboTimer = 0;
      glitchPulse = 0;
      missPulse = 0;
      spawnTimer = 0;
      arenaTime = 0;
      targetSpeedScale = 1;
      shakeFrames = 0;
      targets.length = 0;
      particles.length = 0;
      ripples.length = 0;
      shotsFx.length = 0;
      for (let i = 0; i < 5; i++) spawnTarget();
      updateHudText();
    }

    addListener(overlay, "mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, true);

    addListener(overlay, "mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      fireShot();
    }, true);

    addListener(overlay, "contextmenu", (e) => {
      e.preventDefault();
    }, true);

    addListener(d, "keydown", (e) => {
      if (e.key === "Escape") window.__glitchcadeCleanup && window.__glitchcadeCleanup();
      if (e.key === "r" || e.key === "R") resetArena();
    }, true);

    function drawBackground() {
      const jitterX = shakeFrames > 0 ? rand(-5, 5) : 0;
      const jitterY = shakeFrames > 0 ? rand(-3, 3) : 0;

      ctx.save();
      ctx.translate(jitterX, jitterY);
      ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);
      ctx.fillStyle = "rgba(4,8,18,0.15)";
      ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

      for (let y = 0; y < canvas.height; y += 5) {
        ctx.fillStyle = "rgba(255,255,255,0.022)";
        ctx.fillRect(0, y, canvas.width, 1);
      }

      if (glitchPulse > 0 || missPulse > 0) {
        const a = Math.min(0.18, (glitchPulse + missPulse) / 120);
        for (let i = 0; i < 5; i++) {
          const gy = (arenaTime * 13 + i * 77) % canvas.height;
          ctx.fillStyle = `rgba(103,239,255,${a})`;
          ctx.fillRect(0, gy, canvas.width, 3);
          ctx.fillStyle = `rgba(255,79,216,${a * 0.95})`;
          ctx.fillRect(0, gy + 4, canvas.width, 2);
        }
      }

      ctx.restore();
    }

    function drawTarget(t) {
      const ringColor = t.hue === "cyan" ? "rgba(103,239,255,0.96)" : "rgba(255,79,216,0.96)";
      const fillColor = t.hue === "cyan" ? "rgba(8,50,66,0.55)" : "rgba(64,10,44,0.55)";

      ctx.save();
      ctx.translate(t.x, t.y);
      const pulse = 1 + Math.sin(t.life * 0.14 + t.phase) * 0.08;
      ctx.scale(pulse, pulse);

      ctx.shadowColor = ringColor;
      ctx.shadowBlur = 24 + (combo > 3 ? 8 : 0);

      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = ringColor;
      ctx.beginPath();
      ctx.arc(0, 0, t.radius - 1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.beginPath();
      ctx.arc(0, 0, t.radius * 0.52, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-t.radius - 6, 0);
      ctx.lineTo(-t.radius * 0.35, 0);
      ctx.moveTo(t.radius * 0.35, 0);
      ctx.lineTo(t.radius + 6, 0);
      ctx.moveTo(0, -t.radius - 6);
      ctx.lineTo(0, -t.radius * 0.35);
      ctx.moveTo(0, t.radius * 0.35);
      ctx.lineTo(0, t.radius + 6);
      ctx.stroke();

      if (t.hp > 1) {
        ctx.fillStyle = "rgba(255,210,122,0.9)";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(t.hp), 0, 4);
      }

      ctx.restore();
    }

    function drawParticles() {
      for (const p of particles) {
        const a = clamp01(p.life / p.maxLife);
        const color = p.color.includes("0.95") ? p.color.replace("0.95", a.toFixed(2)) : p.color.replace("0.9", a.toFixed(2));
        ctx.fillStyle = color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }

    function drawRipples() {
      for (const r of ripples) {
        const a = clamp01(r.life / r.maxLife);
        ctx.strokeStyle = `rgba(103,239,255,${a * 0.35})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawShots() {
      for (const s of shotsFx) {
        const a = clamp01(s.life / 8);
        ctx.strokeStyle = `rgba(255,255,255,${a * 0.95})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x - 12, s.y);
        ctx.lineTo(s.x + 12, s.y);
        ctx.moveTo(s.x, s.y - 12);
        ctx.lineTo(s.x, s.y + 12);
        ctx.stroke();
      }
    }

    function drawCrosshair() {
      const aura = combo > 2 ? 20 : 14;
      ctx.save();
      ctx.shadowColor = combo > 2 ? "rgba(255,79,216,0.75)" : "rgba(103,239,255,0.75)";
      ctx.shadowBlur = 20 + combo * 2;

      ctx.strokeStyle = "rgba(103,239,255,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,79,216,0.65)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mouseX - aura, mouseY);
      ctx.lineTo(mouseX - 5, mouseY);
      ctx.moveTo(mouseX + 5, mouseY);
      ctx.lineTo(mouseX + aura, mouseY);
      ctx.moveTo(mouseX, mouseY - aura);
      ctx.lineTo(mouseX, mouseY - 5);
      ctx.moveTo(mouseX, mouseY + 5);
      ctx.lineTo(mouseX, mouseY + aura);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawTrail() {
      ctx.save();
      ctx.fillStyle = combo > 2 ? "rgba(255,79,216,0.18)" : "rgba(103,239,255,0.16)";
      for (let i = 0; i < 5; i++) {
        const tx = mouseX - i * 9;
        const ty = mouseY + Math.sin((arenaTime + i) * 0.25) * 3;
        ctx.fillRect(tx - 2, ty - 2, 4, 4);
      }
      ctx.restore();
    }

    function updateWorld() {
      arenaTime += 1;
      spawnTimer -= 1;
      if (comboTimer === 0 && combo > 0) combo = 0;

      targetSpeedScale = 1 + Math.min(score / 2800, 1.4);
      const minTargets = 4 + Math.min(Math.floor(score / 1200), 4);

      if (targets.length < minTargets || spawnTimer <= 0) {
        spawnTarget();
        spawnTimer = Math.max(14, 48 - Math.floor(score / 180));
      }

      for (const t of targets) {
        t.life += 1;
        t.x += t.vx;
        t.y += t.vy + Math.sin(t.life * 0.04 + t.phase) * 0.12;
        if (t.x < t.radius + 14 || t.x > canvas.width - t.radius - 14) t.vx *= -1;
        if (t.y < t.radius + 80 || t.y > canvas.height - t.radius - 40) t.vy *= -1;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.life -= 1;
        if (p.life <= 0) particles.splice(i, 1);
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += 3.2;
        r.life -= 1;
        if (r.life <= 0) ripples.splice(i, 1);
      }

      for (let i = shotsFx.length - 1; i >= 0; i--) {
        shotsFx[i].life -= 1;
        if (shotsFx[i].life <= 0) shotsFx.splice(i, 1);
      }

      if (glitchPulse > 0) glitchPulse -= 1;
      if (missPulse > 0) missPulse -= 1;
      if (shakeFrames > 0) shakeFrames -= 1;
    }

    function renderFrame() {
      drawBackground();
      drawRipples();
      for (const t of targets) drawTarget(t);
      drawParticles();
      drawTrail();
      drawShots();
      drawCrosshair();
      updateHudText();
    }

    function loop() {
      updateWorld();
      renderFrame();
      state.raf = requestAnimationFrame(loop);
    }

    resetArena();
    loop();
  }


  function startPong(options = {}) {
    // Hard-stop audio from any previous game instance before constructing a
    // new one. Mobile orientation changes can race delayed launch callbacks.
    if (typeof window.__glitchPongStopAudio === "function") {
      try { window.__glitchPongStopAudio(); } catch (error) {}
      window.__glitchPongStopAudio = null;
    }
    const shell = installBaseShell("TRUE DOM PONG", "TRUE DOM PONG // CHOOSE MODE");
    const { ctx, canvas, updateHUD, state, addListener, addTimer, overlay, hud, help } = shell;

    hud.style.display = "none";
    help.style.display = "none";
    help.textContent = "GLITCH PONG // W/S or ↑/↓ // Shift + direction dash // Esc back/pause // R restart";
    shell.closeBtn.style.display = "none";

    const audioUserInitiated = !!options.audioUserInitiated;
    const introVoiceDelayMs = Number.isFinite(options.introVoiceDelayMs) ? Math.max(0, options.introVoiceDelayMs) : 3000;
    const introVoiceStartAtMs = Number.isFinite(options.introVoiceStartAtMs) ? options.introVoiceStartAtMs : Date.now();
    let currentScreen = "main";
    let isPaused = false;

    const BLUE_PADDLE_SRC = resolveAssetPath("assets/blue_paddle.png");
    const RED_PADDLE_SRC = resolveAssetPath("assets/red_paddle.png");
    const PONG_MENU_SRC = resolveAssetPath("assets/glitch_pong_menu_FINAL.png");
    const MAIN_MENU_SRC = resolveAssetPath("assets/glitch_pong_main_menu.png");
    const PAUSE_MENU_SRC = resolveAssetPath("assets/pause_menu.png");
    const COUNTDOWN_3_SRC = resolveAssetPath("assets/3.png");
    const COUNTDOWN_2_SRC = resolveAssetPath("assets/2.png");
    const COUNTDOWN_1_SRC = resolveAssetPath("assets/1.png");
    const COUNTDOWN_GO_SRC = resolveAssetPath("assets/GO.png");
    const BOSS_EYE_LEFT_SRC = resolveAssetPath("assets/boss_eye_left.png");
    const BOSS_EYE_RIGHT_SRC = resolveAssetPath("assets/boss_eye_right.png");
    const BOSS_EYE_NEUTRAL_SRC = resolveAssetPath("assets/boss_eye_neutral.png");
    const BOSS_EYE_LEFT_BLINK_SRC = resolveAssetPath("assets/left_eye_blink.png");
    const BOSS_EYE_RIGHT_BLINK_SRC = resolveAssetPath("assets/right_eye_blink.png");
    const BOSS_EYE_NEUTRAL_BLINK_SRC = resolveAssetPath("assets/straight_eye_blink.png");

    // ── Mobile detection: scale ball & paddle for touch screens ──────────────
    const mobilePointer = navigator.maxTouchPoints > 0 || 'ontouchstart' in window || window.matchMedia?.('(pointer: coarse)').matches;
    const compactLandscape = Math.min(window.innerWidth, window.innerHeight) <= 500 && Math.max(window.innerWidth, window.innerHeight) <= 1024;
    const isMobileDevice = (mobilePointer && window.innerWidth < 1200) || compactLandscape;

    // Keep gameplay objects out of iPhone notches and rounded screen corners
    // while allowing the arena background to remain truly edge-to-edge.
    let safeInsetLeft = 0;
    let safeInsetRight = 0;
    const safeAreaProbe = document.createElement("div");
    safeAreaProbe.setAttribute("aria-hidden", "true");
    safeAreaProbe.style.cssText = [
      "position:absolute", "inset:0", "visibility:hidden", "pointer-events:none",
      "padding-left:env(safe-area-inset-left, 0px)",
      "padding-right:env(safe-area-inset-right, 0px)"
    ].join(";");
    overlay.appendChild(safeAreaProbe);

    function refreshGameplaySafeArea() {
      if (!isMobileDevice) {
        safeInsetLeft = 0;
        safeInsetRight = 0;
        return;
      }
      const safeStyle = getComputedStyle(safeAreaProbe);
      const maxInset = Math.max(0, canvas.width * 0.12);
      safeInsetLeft = Math.min(maxInset, Math.max(0, parseFloat(safeStyle.paddingLeft) || 0));
      safeInsetRight = Math.min(maxInset, Math.max(0, parseFloat(safeStyle.paddingRight) || 0));
    }

    refreshGameplaySafeArea();

    if (isMobileDevice) {
      overlay.classList.add("gp-mobile-ui");
      const mobileUiStyle = document.createElement("style");
      mobileUiStyle.id = "__gp_mobile_ui_style";
      mobileUiStyle.textContent = `
        #__glitchcade_overlay.gp-mobile-ui { touch-action:auto !important; }
        #__glitchcade_overlay.gp-mobile-ui canvas { touch-action:none !important; }
        .gp-mobile-ui .gp-mobile-panel {
          width:calc(100% - 16px) !important;
          max-width:760px !important;
          max-height:calc(100% - 12px) !important;
          padding:12px 14px !important;
          border-radius:16px !important;
          overflow-x:hidden !important;
          overflow-y:auto !important;
          overscroll-behavior:contain !important;
          touch-action:pan-y !important;
          -webkit-overflow-scrolling:touch;
          scrollbar-width:thin;
        }
        .gp-mobile-ui .gp-mobile-panel button,
        .gp-mobile-ui .gp-mobile-panel input { min-height:44px; }
        .gp-mobile-ui #gp-main-menu,
        .gp-mobile-ui #gp-mode-menu,
        .gp-mobile-ui #gp-pause-menu {
          width:min(96vw, calc((100dvh - 12px) * 1.7778), 980px) !important;
          height:auto !important;
          max-height:calc(100dvh - 12px) !important;
          aspect-ratio:16 / 9 !important;
        }
        .gp-mobile-ui #gp-main-menu [aria-label="Play"],
        .gp-mobile-ui #gp-main-menu [aria-label="Settings"],
        .gp-mobile-ui #gp-mode-menu [aria-label="Player 1"],
        .gp-mobile-ui #gp-mode-menu [aria-label="Player 2"] { min-height:44px; }
        .gp-mobile-ui .gp-corner-action {
          width:44px !important;
          height:44px !important;
          min-height:44px !important;
          padding:0 !important;
          justify-content:center !important;
          border-radius:12px !important;
        }
        .gp-mobile-ui .gp-corner-action span { display:none !important; }
        .gp-mobile-ui #gp-stats-action { right:11% !important; }
        .gp-mobile-ui #gp-store-action { right:2.5% !important; }
        .gp-mobile-ui #gp-pause-menu button { min-width:44px; min-height:44px; }
        .gp-mobile-ui #gp-tab-bar {
          display:grid !important;
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          gap:6px !important;
          position:sticky;
          top:-12px;
          z-index:4;
          padding:4px 0 8px;
          background:rgba(6,11,22,.98);
        }
        .gp-mobile-ui #gp-tab-bar button {
          min-height:44px;
          padding:7px 4px !important;
          font-size:10px !important;
          letter-spacing:.05em !important;
        }
        .gp-mobile-ui #gp-pane-controls > div:not(#gp-controls-body) { display:none !important; }
        .gp-mobile-ui #gp-settings-panel > div:first-child,
        .gp-mobile-ui #gp-stats-panel > div:first-child { font-size:19px !important; margin-bottom:8px !important; }
        .gp-mobile-ui #gp-pane-howto > div:nth-child(2),
        .gp-mobile-ui #gp-appearance-body > div:nth-child(2) {
          grid-template-columns:1fr !important;
        }
        .gp-mobile-ui .gp-stats-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
        .gp-mobile-ui .gp-arena-record {
          grid-template-columns:1.5fr repeat(2,.7fr) !important;
          font-size:10px !important;
        }
        .gp-mobile-ui .gp-arena-record .gp-mobile-hide { display:none !important; }
        .gp-mobile-ui .gp-stat-insights { grid-template-columns:1fr !important; }
        .gp-mobile-ui #gp-arena-panel { touch-action:pan-x pan-y !important; }
        .gp-mobile-ui .gp-arena-title,
        .gp-mobile-ui .gp-difficulty-title { font-size:20px !important; margin-bottom:3px !important; }
        .gp-mobile-ui .gp-arena-hint { font-size:10px !important; margin-bottom:10px !important; }
        .gp-mobile-ui .gp-arena-grid {
          display:flex !important;
          gap:10px !important;
          overflow-x:auto !important;
          overflow-y:hidden !important;
          scroll-snap-type:x mandatory;
          touch-action:pan-x !important;
          padding:2px 2px 8px;
          margin-bottom:8px !important;
          -webkit-overflow-scrolling:touch;
        }
        .gp-mobile-ui .gp-arena-card {
          flex:0 0 min(68vw,250px);
          min-width:min(68vw,250px);
          scroll-snap-align:center;
          padding:12px 9px !important;
        }
        .gp-mobile-ui .gp-arena-card > div:first-child { font-size:17px !important; }
        .gp-mobile-ui .gp-mobile-sticky-actions {
          position:sticky;
          bottom:-12px;
          z-index:3;
          padding:6px 0 2px;
          background:rgba(5,9,18,.96);
        }
        .gp-mobile-ui .gp-difficulty-grid { gap:8px !important; margin-bottom:12px !important; }
        .gp-mobile-ui .gp-difficulty-grid > button { padding:11px 6px !important; border-radius:12px !important; }
        .gp-mobile-ui .gp-difficulty-grid > button > div:first-child { font-size:17px !important; margin-bottom:6px !important; }
        .gp-mobile-ui .gp-difficulty-grid > button > div:last-child { font-size:9px !important; line-height:1.45 !important; }
        .gp-mobile-ui .gp-ai-toggle-row { grid-template-columns:1fr !important; gap:8px !important; margin:0 0 10px !important; }
        .gp-mobile-ui .gp-ai-toggle-row [data-ai-vs-ai] { grid-column:1 !important; }
        .gp-mobile-ui .gp-online-panel input { font-size:16px !important; }
        .gp-mobile-ui .gp-online-actions { gap:7px !important; }
        .gp-mobile-ui .gp-online-actions button { padding:9px 10px !important; }
        .gp-mobile-ui .gp-online-button-row { flex-wrap:wrap; }
        .gp-mobile-ui #gp-game-hud {
          left:max(8px,env(safe-area-inset-left)) !important;
          right:max(64px,calc(env(safe-area-inset-right) + 58px)) !important;
          top:max(8px,env(safe-area-inset-top)) !important;
          width:auto !important;
          max-width:none !important;
          transform:none !important;
          padding:5px 7px !important;
          white-space:normal !important;
          overflow:visible !important;
          line-height:1.25 !important;
        }
        .gp-mobile-ui .gp-mobile-hud-grid {
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:4px;
          align-items:center;
        }
        .gp-mobile-ui .gp-mobile-hud-grid span { white-space:nowrap; text-align:center; }
        .gp-mobile-ui .gp-mobile-hud-status { margin-top:3px; text-align:center; font-size:8px; }
      `;
      document.head.appendChild(mobileUiStyle);
      state.listeners.push(() => mobileUiStyle.remove());
    }

    // Mobile performance controller. It only changes visual density, never
    // gameplay timing or physics, so adaptive quality cannot alter a rally.
    const PERFORMANCE_STORAGE_KEY = "glitchPongPerformance";
    let batterySaverEnabled = false;
    try {
      const savedPerformance = JSON.parse(localStorage.getItem(PERFORMANCE_STORAGE_KEY) || "null");
      batterySaverEnabled = !!(savedPerformance && savedPerformance.batterySaver);
    } catch (error) {}
    let adaptiveQualityLevel = isMobileDevice ? 1 : 2; // 0 low, 1 balanced, 2 high
    let measuredFps = 60;
    let qualitySampleStart = 0;
    let qualitySampleFrames = 0;
    let lowFpsWindows = 0;
    let highFpsWindows = 0;

    function savePerformanceSettings() {
      try {
        localStorage.setItem(PERFORMANCE_STORAGE_KEY, JSON.stringify({ batterySaver: batterySaverEnabled }));
      } catch (error) {}
    }

    function getVisualQualityScale() {
      if (batterySaverEnabled) return 0.42;
      return adaptiveQualityLevel === 2 ? 1 : adaptiveQualityLevel === 1 ? 0.72 : 0.50;
    }

    function getVisualQualityLabel() {
      if (batterySaverEnabled) return "BATTERY SAVER";
      return adaptiveQualityLevel === 2 ? "HIGH" : adaptiveQualityLevel === 1 ? "BALANCED" : "LOW";
    }

    function sampleAdaptiveQuality(now) {
      if (!isMobileDevice || batterySaverEnabled || currentScreen !== "game" || isPaused || document.hidden) {
        qualitySampleStart = now || performance.now();
        qualitySampleFrames = 0;
        return;
      }
      if (!qualitySampleStart) qualitySampleStart = now;
      qualitySampleFrames += 1;
      const elapsed = now - qualitySampleStart;
      if (elapsed < 1800) return;
      measuredFps = Math.round((qualitySampleFrames * 1000) / Math.max(1, elapsed));
      qualitySampleStart = now;
      qualitySampleFrames = 0;

      if (measuredFps < 43) {
        lowFpsWindows += 1;
        highFpsWindows = 0;
        if (lowFpsWindows >= 2 && adaptiveQualityLevel > 0) {
          adaptiveQualityLevel -= 1;
          lowFpsWindows = 0;
        }
      } else if (measuredFps > 56) {
        highFpsWindows += 1;
        lowFpsWindows = 0;
        if (highFpsWindows >= 3 && adaptiveQualityLevel < 2) {
          adaptiveQualityLevel += 1;
          highFpsWindows = 0;
        }
      } else {
        lowFpsWindows = 0;
        highFpsWindows = 0;
      }
    }

    let paddleH = isMobileDevice ? Math.round(canvas.height * 0.25) : 140;   // ~94 on 375 h
    let paddleW = isMobileDevice ? 22 : 22;
    const paddleEdgeGap = isMobileDevice ? 14 : 20;
    let leftX = paddleEdgeGap + safeInsetLeft;
    let rightX = canvas.width - paddleEdgeGap - safeInsetRight - paddleW;
    const BALL_R = isMobileDevice ? 9 : 10;   // base ball radius

    // Heat system: scale so heat builds at roughly the same rate regardless of
    // screen size. On mobile the court is ~3-4× narrower so the ball crosses it
    // much more often, which would otherwise make heat spike instantly.
    // Reference desktop width ≈ 1200 px. Clamp scale between 0.6 and 1.
    const _heatWidthScale = Math.min(1, Math.max(0.6, canvas.width / 1200));
    const HEAT_PER_HIT  = 12.5 * _heatWidthScale;   // mobile ~6-8, desktop 12.5
    const HEAT_DECAY_BASE  = isMobileDevice ? 0.030 : 0.022;
    const HEAT_DECAY_SCALE = isMobileDevice ? 0.022 : 0.017;

    let leftY  = canvas.height / 2 - paddleH / 2;
    let rightY = canvas.height / 2 - paddleH / 2;
    let ballX = canvas.width / 2;
    let ballY = canvas.height / 2;
    let vx = 6 * (Math.random() > 0.5 ? 1 : -1);
    let vy = (Math.random() * 4) - 2;
    let leftScore = 0;
    let rightScore = 0;
    const WIN_SCORE = 7;
    let gameOver = false;
    let winner = null;

    let modeSelected = false;
    let twoPlayerMode = false;
    // Online games never run the local simulation. This state only holds the
    // latest server snapshot plus socket/session credentials for reconnection.
    const onlineState = { active:false, socket:null, session:null, snapshot:null, input:"stop", ended:false, reconnecting:false, statsRecorded:false };
    let aiDifficulty = "medium"; // "easy" | "medium" | "hard"
    let aiVsAiMode = false;       // spectator mode: both paddles use aiDifficulty
    let roundFrozen = true;
    let pendingLaunchDir = 1;

    // ── Ball Sentience ─────────────────────────────────────────────────────
    // Spite: track score gap so ball develops a subtle bias toward loser
    let spiteBias       = 0;   // -1 = help left, +1 = help right, 0 = neutral
    // Exhaustion: after 30+ hits, ball wobbles as if tired
    let exhaustionPhase = 0;   // sine phase in radians
    let exhaustionAmp   = 0;   // wobble amplitude (px/frame added to vy)
    // Drowsy visuals — Z particles that float up from the ball during exhaustion
    let drowsyZs           = [];   // array of { x,y,vx,vy,size,rot,life,maxLife }
    let drowsyZSpawnTimer  = 0;
    let drowsyWarningTimer = 0;    // countdown for "DROWSY" flash banner
    let drowsyWarningShown = false;
    // Memory: last 3 Y positions where each side MISSED (ball went past paddle)
    const missMemory = { left: [], right: [] };
    // Wall-stuck detection: if wall bounce fires twice within 1 second, teleport the ball
    let lastWallBounceTime = 0;

    // ── Key Bindings ──────────────────────────────────────────────────────
    const KB_STORAGE = "glitchPong_keyBindings_v1";
    const KB_DEFAULTS = {
      p1Up:   "KeyW",
      p1Down: "KeyS",
      p1Dash: "ShiftLeft",
      p2Up:   "ArrowUp",
      p2Down: "ArrowDown",
      p2Dash: "ShiftRight"
    };

    let keyBindings = (() => {
      try {
        const saved = JSON.parse(localStorage.getItem(KB_STORAGE) || "{}");
        return Object.assign({}, KB_DEFAULTS, saved);
      } catch(e) { return Object.assign({}, KB_DEFAULTS); }
    })();

    function saveKeyBindings() {
      try { localStorage.setItem(KB_STORAGE, JSON.stringify(keyBindings)); } catch(e) {}
    }

    // Human-readable label for a key code
    function codeToLabel(code) {
      if (!code) return "—";
      const map = {
        ShiftLeft:"L.Shift", ShiftRight:"R.Shift",
        Space:"Space", Enter:"Enter", Escape:"Esc",
        Backspace:"Back", Tab:"Tab", CapsLock:"Caps",
        ArrowUp:"↑", ArrowDown:"↓", ArrowLeft:"←", ArrowRight:"→",
        ControlLeft:"L.Ctrl", ControlRight:"R.Ctrl",
        AltLeft:"L.Alt", AltRight:"R.Alt"
      };
      if (map[code]) return map[code];
      if (code.startsWith("Key"))    return code.slice(3);
      if (code.startsWith("Digit"))  return code.slice(5);
      if (code.startsWith("Numpad")) return "Num" + code.slice(6);
      if (code.startsWith("F") && !isNaN(code.slice(1))) return code;
      return code;
    }

    let rebindingTarget = null;  // key of keyBindings currently being captured
    let shakeFrames = 0;
    let scoreFlashFrames = 0;
    let breachFlashFrames = 0;
    let breachSide = 0;
    let glitchPulse = 0;
    let arenaJitter = 0;
    let heat = 0;
    let rallyHits = 0;
    const HEAT_MAX = 100;

    // New additive systems: combo, decoys, clutch mode.
    let combo = 0;
    let comboTimer = 0;
    const COMBO_MAX_TIME = 120;
    let decoys = [];

    // ── Color Charge & Critical Heat ─────────────────────────────────────────
    let colorCharge     = 1;     // consecutive same-paddle hits (1 = base, 6 = max)
    let lastHitSide     = null;  // 'left' | 'right' | null
    let chargeFlashT    = 0;     // brief flash timer on charge-up
    let criticalHeat    = false; // heat >= HEAT_CRITICAL
    let criticalHeatTimer = 0;   // countdown for "CRITICAL HEAT" warning display
    const HEAT_CRITICAL   = 80;  // % threshold for 3-point color-match penalty
    const MAX_COLOR_CHARGE = 6;

    // ── Glitch Wall System ────────────────────────────────────────────────
    let glitchWalls = [];
    let glitchWallSpawnCooldown = 240;
    let decoyCooldown = 300;
    let clutchMode = false;

    // Glitch behavior state.
    let ballTrail = [];
    const ghostTrailLimit = 6;
    let pulseFrames = 0;
    let pulseCooldown = 240 + Math.floor(Math.random() * 240);
    let speedMultiplier = 1;
    let teleportCooldown = 600 + Math.floor(Math.random() * 600);
    let jukeCooldown = 300 + Math.floor(Math.random() * 300);

    // Cinematic camera state.
    let cameraZoom = 1;
    let cameraTargetZoom = 1;
    let cameraKickX = 0;
    let cameraKickY = 0;
    let cameraDriftX = 0;
    let cameraDriftY = 0;
    let impactFreezeFrames = 0;

    // Paddle dash state. Human players get a short glitch burst movement.
    const DASH_DISTANCE = 76;
    const DASH_COOLDOWN_MAX = 58;
    let leftDashCooldown = 0;
    let rightDashCooldown = 0;
    let leftDashTrail = [];
    let rightDashTrail = [];

    // Powerup system: only one arena pickup exists at a time. The ball color tracks
    // ownership, and whichever paddle owns the ball when it collects the pickup gets
    // the reward.
    let ballOwner = "neutral";
    let arenaPowerup = null;
    let powerupSpawnCooldown = 520;
    const POWERUP_RADIUS = 16;
    const POWERUP_TYPES = ["shield", "power", "split"];
    const powerState = {
      blue: { shieldTimer: 0, powerStrikeReady: false, splitReady: false },
      red: { shieldTimer: 0, powerStrikeReady: false, splitReady: false }
    };

    const keys = { w:false, s:false, up:false, down:false };

    // Cosmetic-only paddle palettes. These neon values were picked to retain
    // contrast against the Classic, Matrix, and Construct arena palettes.
    const PADDLE_COLOR_OPTIONS = [
      { id:"cyan",    name:"ION CYAN",       hex:"#00d9ff", rgb:"0,217,255" },
      { id:"magenta", name:"HOT MAGENTA",    hex:"#ff4fd8", rgb:"255,79,216" },
      { id:"gold",    name:"SOLAR GOLD",     hex:"#ffd166", rgb:"255,209,102" },
      { id:"orange",  name:"EMBER ORANGE",   hex:"#ff8a3d", rgb:"255,138,61" },
      { id:"violet",  name:"ULTRAVIOLET",    hex:"#b18cff", rgb:"177,140,255" },
      { id:"white",   name:"GHOST WHITE",    hex:"#f4f7ff", rgb:"244,247,255" }
    ];
    const paddleColorSelection = { blue:"cyan", red:"magenta" };

    try {
      const savedPaddleColors = JSON.parse(localStorage.getItem("glitchPongPaddleColors") || "null");
      if (savedPaddleColors && PADDLE_COLOR_OPTIONS.some(c => c.id === savedPaddleColors.blue) && PADDLE_COLOR_OPTIONS.some(c => c.id === savedPaddleColors.red)) {
        paddleColorSelection.blue = savedPaddleColors.blue;
        paddleColorSelection.red = savedPaddleColors.red;
      }
    } catch (error) {}

    // Older saves could contain duplicate colours. Repair them once so every
    // match has instantly readable, distinct paddles.
    if (paddleColorSelection.blue === paddleColorSelection.red) {
      paddleColorSelection.red = PADDLE_COLOR_OPTIONS.find(color => color.id !== paddleColorSelection.blue).id;
      try { localStorage.setItem("glitchPongPaddleColors", JSON.stringify(paddleColorSelection)); } catch (error) {}
    }

    function getPaddleColor(owner) {
      const id = paddleColorSelection[owner];
      return PADDLE_COLOR_OPTIONS.find(color => color.id === id) || PADDLE_COLOR_OPTIONS[0];
    }

    function ownerRgb(owner) {
      return owner === "neutral" ? "255,255,255" : getPaddleColor(owner).rgb;
    }

    function ownerHex(owner) {
      return owner === "neutral" ? "#ffffff" : getPaddleColor(owner).hex;
    }

    function setPaddleColor(owner, colorId) {
      if (!PADDLE_COLOR_OPTIONS.some(color => color.id === colorId)) return;
      const otherOwner = owner === "blue" ? "red" : "blue";
      if (paddleColorSelection[otherOwner] === colorId) return;
      paddleColorSelection[owner] = colorId;
      try { localStorage.setItem("glitchPongPaddleColors", JSON.stringify(paddleColorSelection)); } catch (error) {}
    }

    const bluePaddleImage = new Image();
    const redPaddleImage = new Image();
    const countdown3Image = new Image();
    const countdown2Image = new Image();
    const countdown1Image = new Image();
    const countdownGoImage = new Image();
    const bossEyeLeftImage = new Image();
    const bossEyeRightImage = new Image();
    const bossEyeNeutralImage = new Image();
    const bossEyeLeftBlinkImage = new Image();
    const bossEyeRightBlinkImage = new Image();
    const bossEyeNeutralBlinkImage = new Image();
    let bossEyeLeftReady = false;
    let bossEyeRightReady = false;
    let bossEyeNeutralReady = false;
    let bossEyeLeftBlinkReady = false;
    let bossEyeRightBlinkReady = false;
    let bossEyeNeutralBlinkReady = false;
    let leftImageReady = false;
    let rightImageReady = false;
    let rallyHeatAudio = 0;

    // Countdown / launch staging. The ball waits until GO clears the screen.
    let countdownActive = false;
    let countdownPhaseIndex = -1;
    let countdownFrame = 0;
    const COUNTDOWN_PHASES = [
      { key: "3", duration: 34 },
      { key: "2", duration: 34 },
      { key: "1", duration: 34 },
      { key: "GO", duration: 38 }
    ];


    // ─── In-game Progression State ──────────────────────────────────────────
    // Loaded once when the game initialises; survives restarts via GlitchProgression
    let progScreen = null;   // null | 'levelUp' | 'perkSelect' | 'matchSummary'
    let progScreenTimer  = 0;
    let progLevelData    = null;   // { level, title }
    let progPerkOptions  = [];     // array of 3 perk objects
    let progSelectedPerk = 0;     // 0/1/2 keyboard choice
    let progSummaryData  = null;   // match summary object
    let progSummaryTimer = 0;
    let xpFloats         = [];    // floating "+N XP" text particles
    let xpBarGlow        = 0;     // bright flash when XP arrives
    let matchRallyHits   = 0;     // hits this match for XP tracking
    let matchBossHit     = false; // did boss hit a player this match?
    let matchStartScore  = {left:0, right:0};
    let matchStartLevel  = 1;     // level snapshot at match start for summary delta
    let matchWinner      = null;  // 'left' | 'right' | null

    // Perk hotkey labels
    const PERK_KEYS = ["[1]", "[2]", "[3]"];

    // ─── XP Award Helper ────────────────────────────────────────────────────
    function awardXP(amount, reason, x, y) {
      // AI vs AI is a spectator simulation, never a source of player progress.
      if (aiVsAiMode) return 0;
      const earned = GlitchProgression.addXP(amount, reason);
      if (earned && x !== undefined && y !== undefined) {
        xpFloats.push({ x, y: y - 10, text: `+${earned} XP`, life: 80, maxLife: 80, vy: -0.7 });
      }
      xpBarGlow = Math.min(1, xpBarGlow + 0.6);
    }

    // ─── Process Queued Level-Ups ───────────────────────────────────────────
    function processPendingLevelUps() {
      if (progScreen) return; // already showing something
      const levels = GlitchProgression.drainLevelUps();
      const perks   = GlitchProgression.drainPerkChoices();
      if (levels.length === 0) return;
      const newLvl = levels[levels.length - 1];
      if (perks.length > 0) {
        progScreen      = "perkSelect";
        progPerkOptions = GlitchProgression.getRandomPerks(3);
        progSelectedPerk = 0;
        progScreenTimer = 0;
        progLevelData = { level: newLvl, title: GlitchProgression.getTitle(newLvl) };
      } else {
        progScreen    = "levelUp";
        progLevelData = { level: newLvl, title: GlitchProgression.getTitle(newLvl) };
        progScreenTimer = 180; // auto-dismiss after 3 s
      }
    }

    // Start match tracking
    GlitchProgression.beginMatch();
    matchStartScore = { left: leftScore, right: rightScore };


    let aiDashDecisionCooldown = 0;
    let menuDemoResetCooldown = 0;
    const aiTrackingState = {
      left:  { wasApproaching: false, aimError: 0, trackedY: null, reactionTimer: 0 },
      right: { wasApproaching: false, aimError: 0, trackedY: null, reactionTimer: 0 }
    };

    // Final-score cinematic: freeze-frame + effects only after the winning point is confirmed.
    let finalPointSlowMo = false;
    let finalPointSlowMoMix = 0;
    let finalScoreCinematic = false;
    let finalScoreCinematicTimer = 0;
    let finalScoreSide = null;
    let finalScoreTrailSnapshot = [];
    let finalScoreBallSnapshot = null;

    // Corruption boss fight state. This hijacks the rally at max heat without replacing the normal Pong systems.
    const BOSS_PHASES = {
      ALARM: "alarm",
      CENTER_GLITCH: "center_glitch",
      MATERIALIZE: "materialize",
      AIM: "aim",
      THROW: "throw",
      RESOLVE: "resolve",
      OUTRO: "outro"
    };
    let bossModeActive = false;
    let bossTriggeredThisRally = false;
    let bossEncounteredThisMatch = false;
    let bossPhase = BOSS_PHASES.ALARM;
    let bossPhaseTimer = 0;
    let bossOutcome = null;
    let bossData = null;

    // ── Pre-Boss Cinematic ──────────────────────────────────────────────────
    let preBossActive  = false;
    let preBossTimer   = 0;
    let preBossSnapX   = 0;   // where ball was when heat maxed
    let preBossSnapY   = 0;
    const PB_SPEECH    = 80;  // frames: ball frozen, speech bubble visible
    const PB_GLITCH    = 120; // frames: ball glitches to center
    const PB_MORPH     = 195; // frames: ball morphs into eye
    const pongAudio = (() => {
      const SOUND_FILES = {
        gameTracks: [
          "sounds/music/in_game_music1.mp3",
          "sounds/music/in_game_music2.mp3",
          "sounds/music/in_game_music3.mp3",
          "sounds/music/in_game_music4.mp3"
        ],
        // Matrix Mainframe arena tracks — drop your files into sounds/music/
        // named matrix_music1.mp3 … matrix_music6.mp3 and they auto-cycle.
        matrixTracks: [
          "sounds/music/matrix_music1.mp3",
          "sounds/music/matrix_music2.mp3",
          "sounds/music/matrix_music3.mp3",
          "sounds/music/matrix_music4.mp3",
          "sounds/music/matrix_music5.mp3",
          "sounds/music/matrix_music6.mp3"
        ],
        // The Construct has its own six-track playlist, selected once per match
        // and cycled with the same no-immediate-repeat rules as every arena.
        constructTracks: [
          "sounds/music/construct_music1.mp3",
          "sounds/music/construct_music2.mp3",
          "sounds/music/construct_music3.mp3",
          "sounds/music/construct_music4.mp3",
          "sounds/music/construct_music5.mp3",
          "sounds/music/construct_music6.mp3"
        ],
        menuMusic: "sounds/music/Menu Music.mp3",
        paddleHit: "sounds/sfx/Paddle Hit Sound.mp3",
        wallBounce: "sounds/sfx/Wall Bounce Sound.mp3",
        score: "sounds/sfx/Score Sound.mp3",
        gameStart: "sounds/sfx/Game Start.mp3",
        glitchPulse: "sounds/sfx/Glitch Pulse.mp3",
        dashActivation: "sounds/sfx/Dash Activation.mp3",
        dashReady: "sounds/sfx/Dash Cooldown Ready.mp3",
        teleport: "sounds/sfx/Teleport Sound.mp3",
        juke: "sounds/sfx/Juke Sound.mp3",
        critical: "sounds/sfx/Critical Moment (high heat + long rally).mp3",
        buttonHover: "sounds/sfx/Button Hover.mp3",
        countdown3: "sounds/sfx/3.mp3",
        countdown2: "sounds/sfx/2.mp3",
        countdown1: "sounds/sfx/1.mp3",
        countdownGo: "sounds/sfx/GO.mp3",
        countdown: "sounds/sfx/Countdown.mp3",
        introVoice: "sounds/sfx/GLITCH PONG.mp3"
      };

      const oneShots = new Map();
      const transientAudios = new Set();
      let primed = false;
      let duckAmount = 0;
      let duckUntil = 0;
      let menuActive = false;
      let musicEnabled = true;
      let sfxEnabled = true;
      let introVoicePlayedForCurrentMenu = false;
      let introVoicePlayedOnceEver = false;
      let introVoiceTimerId = null;
      let menuSequenceToken = 0;
      let menuSequencePending = false;
      let currentMusic = null;
      let currentMusicKey = null;
      let currentMatchTrackIndex = -1;
      let lastMatchTrackIndex = -1;
      let currentMatchPlaylistKey = null;
      let activeGameTracks = SOUND_FILES.gameTracks;  // set per-match based on arena
      const prewarmedFiles = new Set();
      let nexusHum = null;
      let visibilitySuspended = false;
      let sfxContext = null;
      const sfxBuffers = new Map();
      const sfxBufferPromises = new Map();
      const activeSfxSources = new Set();

      function soundUrl(file) {
        try {
          return resolveAssetPath(file);
        } catch (error) {
          console.warn("Glitchcade Pong sound URL fallback:", error);
          return file;
        }
      }

      function createAudio(file, { loop = false, volume = 0.45 } = {}) {
        const audio = new Audio(soundUrl(file));
        audio.loop = loop;
        audio.preload = "auto";
        audio.volume = volume;
        audio.playsInline = true;
        return audio;
      }

      function ensureSfxContext() {
        if (!isMobileDevice) return null;
        if (sfxContext && sfxContext.state !== "closed") return sfxContext;
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return null;
          const shared = window.__glitchPongAudioContext;
          sfxContext = shared && shared.state !== "closed" ? shared : new AudioCtx();
          window.__glitchPongAudioContext = sfxContext;
          return sfxContext;
        } catch (error) {
          sfxContext = null;
          return null;
        }
      }

      function unlockSfxFromGesture() {
        const ctx = ensureSfxContext();
        if (!ctx) return;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        try {
          const source = ctx.createBufferSource();
          source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
          source.connect(ctx.destination);
          source.start(0);
        } catch (error) {}
      }

      function loadSfxBuffer(key) {
        if (sfxBuffers.has(key)) return Promise.resolve(sfxBuffers.get(key));
        if (sfxBufferPromises.has(key)) return sfxBufferPromises.get(key);
        const ctx = ensureSfxContext();
        const file = SOUND_FILES[key];
        if (!ctx || !file) return Promise.reject(new Error("SFX context unavailable"));
        const pending = fetch(soundUrl(file))
          .then((response) => {
            if (!response.ok) throw new Error(`Unable to load ${file}`);
            return response.arrayBuffer();
          })
          .then((bytes) => ctx.decodeAudioData(bytes.slice(0)))
          .then((buffer) => {
            sfxBuffers.set(key, buffer);
            sfxBufferPromises.delete(key);
            return buffer;
          })
          .catch((error) => {
            sfxBufferPromises.delete(key);
            throw error;
          });
        sfxBufferPromises.set(key, pending);
        return pending;
      }

      function playMobileSfx(key, { volume = 0.45, playbackRate = 1 } = {}) {
        const ctx = ensureSfxContext();
        if (!ctx) return false;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const launch = (buffer) => {
          if (!buffer || !sfxEnabled || ctx.state !== "running") return;
          try {
            const source = ctx.createBufferSource();
            const gain = ctx.createGain();
            source.buffer = buffer;
            source.playbackRate.value = playbackRate;
            gain.gain.value = Math.max(0, Math.min(1, volume));
            source.connect(gain);
            gain.connect(ctx.destination);
            activeSfxSources.add(source);
            source.addEventListener("ended", () => activeSfxSources.delete(source), { once: true });
            source.start(0);
          } catch (error) {}
        };
        const ready = sfxBuffers.get(key);
        if (ready) launch(ready);
        else loadSfxBuffer(key).then(launch).catch(() => {});
        return true;
      }

      function prewarmFile(file) {
        if (!file || prewarmedFiles.has(file)) return;
        prewarmedFiles.add(file);
        const audio = createAudio(file, { loop: false, volume: 0 });
        audio.muted = true;
        // Never call play() to prewarm. Some mobile browsers resolve muted
        // media promises out of order after rotation, making orphaned tracks
        // audible together. load() warms the cache without starting playback.
        try { audio.load(); } catch (error) {}
      }

      function getOneShot(key, volume = 0.45) {
        if (oneShots.has(key)) return oneShots.get(key);
        const audio = createAudio(SOUND_FILES[key], { loop: false, volume });
        oneShots.set(key, audio);
        return audio;
      }

      function duckMusic(amount = 0.45, duration = 420) {
        duckAmount = Math.max(duckAmount, Math.max(0, Math.min(0.9, amount)));
        duckUntil = Math.max(duckUntil, performance.now() + duration);
      }

      function stopCurrentMusic(resetTime = true) {
        if (!currentMusic) return;
        currentMusic.pause();
        if (resetTime) {
          try { currentMusic.currentTime = 0; } catch (error) {}
        }
      }

      function stopNexusHum() {
        if (!nexusHum) return;
        try { nexusHum.osc.stop(); } catch (error) {}
        try { nexusHum.ctx.close(); } catch (error) {}
        nexusHum = null;
      }

      function ensureNexusHum() {
        if (nexusHum || !musicEnabled) return nexusHum;
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return null;
          const audioCtx = new AudioCtx();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          const filter = audioCtx.createBiquadFilter();
          osc.type = "sawtooth";
          osc.frequency.value = 38;
          filter.type = "lowpass";
          filter.frequency.value = 115;
          filter.Q.value = 6;
          gain.gain.value = 0;
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          nexusHum = { ctx: audioCtx, osc, gain, filter };
        } catch (error) {
          nexusHum = null;
        }
        return nexusHum;
      }

      function updateNexusHum(heatRatio) {
        const active = currentArenaId === "blackhole" && !menuActive && modeSelected && !gameOver && musicEnabled && !batterySaverEnabled;
        if (!active) {
          stopNexusHum();
          return;
        }
        const hum = ensureNexusHum();
        if (!hum) return;
        if (hum.ctx.state === "suspended") hum.ctx.resume().catch(() => {});
        const now = hum.ctx.currentTime || 0;
        const roar = Math.max(0, (heatRatio - 0.72) / 0.28);
        const pulse = 0.5 + Math.sin(performance.now() * (0.0025 + heatRatio * 0.004)) * 0.5;
        const targetGain = (0.012 + heatRatio * 0.042 + roar * 0.035) * (0.78 + pulse * heatRatio * 0.34);
        const targetFreq = 34 + heatRatio * 26 + roar * 34 + Math.sin(performance.now() * 0.003) * (1.5 + heatRatio * 4);
        try {
          hum.gain.gain.setTargetAtTime(targetGain, now, 0.12);
          hum.osc.frequency.setTargetAtTime(targetFreq, now, 0.18);
          hum.filter.frequency.setTargetAtTime(90 + heatRatio * 160 + roar * 220, now, 0.2);
        } catch (error) {}
      }

      function playMusicSource(file, key, volume = 0.22, { restart = false } = {}) {
        if (!musicEnabled || !file) return;
        visibilitySuspended = false;
        if (currentMusic && currentMusicKey === key) {
          currentMusic.loop = true;
          currentMusic.volume = volume;
          if (restart) {
            try { currentMusic.currentTime = 0; } catch (error) {}
          }
          if (currentMusic.paused) currentMusic.play().catch(() => {});
          return;
        }

        stopCurrentMusic(true);
        currentMusic = createAudio(file, { loop: true, volume });
        currentMusicKey = key;
        currentMusic.play().catch(() => {});
      }

      function chooseNextMatchTrackIndex() {
        const tracks = activeGameTracks;
        if (!tracks || !tracks.length) return -1;
        if (tracks.length === 1) return 0;
        let index = Math.floor(Math.random() * tracks.length);
        if (index === lastMatchTrackIndex) {
          index = (index + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length;
        }
        return index;
      }

      function primeFromGesture() {
        if (isMobileDevice) unlockSfxFromGesture();
        if (primed) return;
        primed = true;

        const mobileAudio = isMobileDevice;
        prewarmFile(SOUND_FILES.menuMusic);
        prewarmFile(SOUND_FILES.introVoice);
        prewarmFile(SOUND_FILES.buttonHover);
        prewarmFile(SOUND_FILES.gameStart);

        // Avoid launching dozens of simultaneous MP3 downloads on a phone.
        // Arena tracks and gameplay SFX load on demand there.
        if (mobileAudio) {
          [
            "buttonHover", "gameStart", "paddleHit", "wallBounce", "score",
            "countdown3", "countdown2", "countdown1", "countdownGo"
          ].forEach((key) => loadSfxBuffer(key).catch(() => {}));
          return;
        }

        for (const track of SOUND_FILES.gameTracks) prewarmFile(track);
        for (const track of SOUND_FILES.matrixTracks) prewarmFile(track);
        for (const track of SOUND_FILES.constructTracks) prewarmFile(track);
        [
          SOUND_FILES.paddleHit,
          SOUND_FILES.wallBounce,
          SOUND_FILES.score,
          SOUND_FILES.glitchPulse,
          SOUND_FILES.dashActivation,
          SOUND_FILES.dashReady,
          SOUND_FILES.teleport,
          SOUND_FILES.juke,
          SOUND_FILES.critical,
          SOUND_FILES.countdown3,
          SOUND_FILES.countdown2,
          SOUND_FILES.countdown1,
          SOUND_FILES.countdownGo
        ].forEach(prewarmFile);
      }

      function playOneShot(key, { volume = 0.45, playbackRate = 1, duck = 0, duckDuration = 0 } = {}) {
        const file = SOUND_FILES[key];
        if (!file || !sfxEnabled) return;
        if (duck > 0 && duckDuration > 0) duckMusic(duck, duckDuration);
        if (isMobileDevice && playMobileSfx(key, { volume, playbackRate })) return;
        const audio = createAudio(file, { loop: false, volume });
        audio.playbackRate = playbackRate;
        transientAudios.add(audio);
        const release = () => transientAudios.delete(audio);
        audio.addEventListener("ended", release, { once: true });
        audio.addEventListener("error", release, { once: true });
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => release());
        }
      }

      function startMusic() {
        menuActive = false;
        menuSequencePending = false;
        introVoicePlayedForCurrentMenu = false;
        if (introVoiceTimerId) {
          clearTimeout(introVoiceTimerId);
          introVoiceTimerId = null;
        }
        const introVoice = getOneShot("introVoice", 0.88);
        introVoice.pause();
        try { introVoice.currentTime = 0; } catch (error) {}
        // Select an arena-specific playlist when one is available.
        const matrixTks = SOUND_FILES.matrixTracks.filter(Boolean);
        const constructTks = SOUND_FILES.constructTracks.filter(Boolean);
        const nextPlaylistKey = currentArenaId === "matrix" && matrixTks.length > 0
          ? "matrix"
          : currentArenaId === "construct" && constructTks.length > 0
            ? "construct"
            : "default";
        activeGameTracks = nextPlaylistKey === "matrix"
          ? matrixTks
          : nextPlaylistKey === "construct"
            ? constructTks
            : SOUND_FILES.gameTracks;

        // A track is selected once per match. launchBallToPlayer() calls this
        // again after every countdown, so restarting here made short mobile
        // rallies repeatedly replay the opening of a song.
        if (currentMusic && currentMusicKey && String(currentMusicKey).startsWith("match-") &&
            currentMatchPlaylistKey === nextPlaylistKey && currentMatchTrackIndex >= 0 &&
            activeGameTracks[currentMatchTrackIndex]) {
          playMusicSource(
            activeGameTracks[currentMatchTrackIndex],
            `match-${currentMatchPlaylistKey}-${currentMatchTrackIndex}`,
            0.22,
            { restart: false }
          );
          return;
        }

        currentMatchTrackIndex = chooseNextMatchTrackIndex();
        if (currentMatchTrackIndex < 0) return;
        lastMatchTrackIndex = currentMatchTrackIndex;
        currentMatchPlaylistKey = nextPlaylistKey;
        playMusicSource(activeGameTracks[currentMatchTrackIndex], `match-${currentMatchPlaylistKey}-${currentMatchTrackIndex}`, 0.22, { restart: true });
      }

      function stopGameMusic() {
        if (currentMusicKey && String(currentMusicKey).startsWith("match-")) {
          stopCurrentMusic(true);
          currentMusic = null;
          currentMusicKey = null;
          currentMatchTrackIndex = -1;
          currentMatchPlaylistKey = null;
        }
        stopNexusHum();
      }

      function stopAll() {
        menuActive = false;
        menuSequencePending = false;
        visibilitySuspended = false;
        stopCurrentMusic(true);
        stopNexusHum();
        currentMusic = null;
        currentMusicKey = null;
        currentMatchTrackIndex = -1;
        currentMatchPlaylistKey = null;
        if (introVoiceTimerId) {
          clearTimeout(introVoiceTimerId);
          introVoiceTimerId = null;
        }
        oneShots.forEach((audio) => {
          audio.pause();
          try { audio.currentTime = 0; } catch (error) {}
          audio.muted = false;
        });
        transientAudios.forEach((audio) => {
          audio.pause();
          try { audio.currentTime = 0; } catch (error) {}
        });
        transientAudios.clear();
        activeSfxSources.forEach((source) => {
          try { source.stop(0); } catch (error) {}
        });
        activeSfxSources.clear();
        introVoicePlayedForCurrentMenu = false;
      }

      function suspendForVisibility() {
        visibilitySuspended = true;
        if (currentMusic) currentMusic.pause();
        transientAudios.forEach((audio) => {
          audio.pause();
          try { audio.currentTime = 0; } catch (error) {}
        });
        transientAudios.clear();
        if (nexusHum && nexusHum.ctx && nexusHum.ctx.state === "running") {
          nexusHum.ctx.suspend().catch(() => {});
        }
        if (sfxContext && sfxContext.state === "running") {
          sfxContext.suspend().catch(() => {});
        }
      }

      function resumeFromVisibility() {
        if (!visibilitySuspended) return;
        visibilitySuspended = false;
        if (currentMusic && musicEnabled && currentMusic.paused) currentMusic.play().catch(() => {});
        if (nexusHum && nexusHum.ctx && nexusHum.ctx.state === "suspended") {
          nexusHum.ctx.resume().catch(() => {});
        }
        if (sfxContext && sfxContext.state === "suspended") {
          sfxContext.resume().catch(() => {});
        }
      }

      function setIntensity(v) {
        const now = performance.now();
        if (duckUntil > now) {
          duckAmount += (Math.max(duckAmount, 0.45) - duckAmount) * 0.18;
        } else {
          duckAmount += (0 - duckAmount) * 0.08;
        }
        const duckScale = 1 - Math.max(0, Math.min(0.85, duckAmount));
        if (currentMusic && musicEnabled) {
          const baseTarget = menuActive ? 0.18 : 0.22;
          currentMusic.volume += ((baseTarget * duckScale) - currentMusic.volume) * 0.08;
        }
        updateNexusHum(Math.max(0, Math.min(1, v || 0)));
      }

      function beginMenuSequence() {
        if (!musicEnabled) return;
        // A mobile tap can surface as touchstart and pointerdown. Do not let
        // those duplicate events restart the intro or menu track.
        if (menuActive && (menuSequencePending ||
            (currentMusicKey === "menu" && currentMusic && !currentMusic.paused))) return;
        const token = ++menuSequenceToken;
        menuActive = true;
        stopGameMusic();
        if (introVoiceTimerId) {
          clearTimeout(introVoiceTimerId);
          introVoiceTimerId = null;
        }

        const shouldPlayIntro = !introVoicePlayedOnceEver;
        if (!shouldPlayIntro) {
          introVoicePlayedForCurrentMenu = false;
          playMusicSource(SOUND_FILES.menuMusic, "menu", 0.22, { restart: false });
          return;
        }

        if (currentMusicKey === "menu") {
          stopCurrentMusic(true);
          currentMusic = null;
          currentMusicKey = null;
        }

        const introVoice = getOneShot("introVoice", 0.88);
        introVoice.pause();
        try { introVoice.currentTime = 0; } catch (error) {}
        introVoicePlayedForCurrentMenu = false;
        introVoicePlayedOnceEver = true;
        menuSequencePending = true;

        let menuStartCommitted = false;

        const startMenuAfterIntro = () => {
          if (token !== menuSequenceToken || !menuActive || !musicEnabled) return;
          if (menuStartCommitted) return;
          menuStartCommitted = true;
          menuSequencePending = false;
          playMusicSource(SOUND_FILES.menuMusic, "menu", 0.22, { restart: true });
        };

        const introPlay = introVoice.play();
        if (introPlay && typeof introPlay.then === "function") {
          introPlay.then(() => {
            introVoicePlayedForCurrentMenu = true;
            const scheduleMenuStart = () => {
              if (token !== menuSequenceToken || !menuActive || !musicEnabled) return;
              introVoiceTimerId = setTimeout(startMenuAfterIntro, 60);
            };
            if (Number.isFinite(introVoice.duration) && introVoice.duration > 0) {
              const remainingMs = Math.max(0, (introVoice.duration - (introVoice.currentTime || 0)) * 1000);
              introVoiceTimerId = setTimeout(startMenuAfterIntro, remainingMs + 60);
            } else {
              introVoice.addEventListener("ended", scheduleMenuStart, { once: true });
              introVoiceTimerId = setTimeout(startMenuAfterIntro, 1900);
            }
          }).catch(() => {
            introVoicePlayedOnceEver = false;
            menuSequencePending = false;
            playMusicSource(SOUND_FILES.menuMusic, "menu", 0.22, { restart: true });
          });
        } else {
          introVoicePlayedOnceEver = false;
          menuSequencePending = false;
          playMusicSource(SOUND_FILES.menuMusic, "menu", 0.22, { restart: true });
        }
      }

      return {
        primeFromGesture,
        startMusic,
        stopGameMusic,
        stopAll,
        suspendForVisibility,
        resumeFromVisibility,
        setIntensity,
        startMenuMusic() {
          beginMenuSequence();
        },
        playIntroVoice() {
          beginMenuSequence();
        },
        stopMenuMusic() {
          menuActive = false;
          menuSequencePending = false;
          menuSequenceToken += 1;
          if (introVoiceTimerId) {
            clearTimeout(introVoiceTimerId);
            introVoiceTimerId = null;
          }
          const introVoice = getOneShot("introVoice", 0.88);
          introVoice.pause();
          try { introVoice.currentTime = 0; } catch (error) {}
          introVoicePlayedForCurrentMenu = false;
          if (currentMusicKey === "menu") {
            stopCurrentMusic(true);
            currentMusic = null;
            currentMusicKey = null;
          }
        },
        buttonHover() { playOneShot("buttonHover", { volume: 0.22, playbackRate: 0.98 + Math.random() * 0.04 }); },
        gameStart() { playOneShot("gameStart", { volume: 0.4, duck: 0.45, duckDuration: 900 }); },
        paddleHit() { playOneShot("paddleHit", { volume: 0.42, playbackRate: 0.96 + Math.random() * 0.1, duck: 0.12, duckDuration: 120 }); },
        paddleHitCharged(charge) {
          const rate = (0.96 + Math.random() * 0.1) * (1 + (charge - 1) * 0.07);
          const vol  = Math.min(0.75, 0.42 + (charge - 1) * 0.06);
          playOneShot("paddleHit", { volume: vol, playbackRate: rate, duck: 0.12, duckDuration: 120 });
        },
        wallBounce() { playOneShot("wallBounce", { volume: 0.24, playbackRate: 0.98 + Math.random() * 0.05 }); },
        score() { playOneShot("score", { volume: 0.46, duck: 0.55, duckDuration: 800 }); },
        glitch() { playOneShot("glitchPulse", { volume: 0.2, playbackRate: 0.97 + Math.random() * 0.06, duck: 0.18, duckDuration: 220 }); },
        dash() { playOneShot("dashActivation", { volume: 0.28, playbackRate: 0.98 + Math.random() * 0.06, duck: 0.14, duckDuration: 160 }); },
        dashReady() { playOneShot("dashReady", { volume: 0.16 }); },
        teleport() { playOneShot("teleport", { volume: 0.32, playbackRate: 0.98 + Math.random() * 0.08, duck: 0.4, duckDuration: 360 }); },
        juke() { playOneShot("juke", { volume: 0.2, playbackRate: 0.98 + Math.random() * 0.08, duck: 0.16, duckDuration: 180 }); },
        critical() { playOneShot("critical", { volume: 0.24, duck: 0.5, duckDuration: 1200 }); },
        countdown() { playOneShot("countdown", { volume: 0.34, duck: 0.20, duckDuration: 180 }); },
        countdown3() { playOneShot("countdown3", { volume: 0.5, duck: 0.20, duckDuration: 180 }); },
        countdown2() { playOneShot("countdown2", { volume: 0.5, duck: 0.20, duckDuration: 180 }); },
        countdown1() { playOneShot("countdown1", { volume: 0.5, duck: 0.20, duckDuration: 180 }); },
        countdownGo() { playOneShot("countdownGo", { volume: 0.62, duck: 0.28, duckDuration: 260 }); },
        isMusicEnabled() { return musicEnabled; },
        isSfxEnabled() { return sfxEnabled; },
        setMusicEnabled(enabled) {
          musicEnabled = !!enabled;
          if (!musicEnabled) {
            this.stopAll();
          } else if (menuActive) {
            beginMenuSequence();
          } else if (modeSelected && !gameOver) {
            startMusic();
          }
        },
        setSfxEnabled(enabled) {
          sfxEnabled = !!enabled;
          if (!sfxEnabled) {
            activeSfxSources.forEach((source) => {
              try { source.stop(0); } catch (error) {}
            });
            activeSfxSources.clear();
          } else if (isMobileDevice) {
            unlockSfxFromGesture();
          }
        }
      };
    })();

    bluePaddleImage.onload = () => { leftImageReady = true; };
    redPaddleImage.onload = () => { rightImageReady = true; };
    bluePaddleImage.src = BLUE_PADDLE_SRC;
    redPaddleImage.src = RED_PADDLE_SRC;
    bossEyeLeftImage.onload = () => { bossEyeLeftReady = true; };
    bossEyeRightImage.onload = () => { bossEyeRightReady = true; };
    bossEyeNeutralImage.onload = () => { bossEyeNeutralReady = true; };
    bossEyeLeftBlinkImage.onload = () => { bossEyeLeftBlinkReady = true; };
    bossEyeRightBlinkImage.onload = () => { bossEyeRightBlinkReady = true; };
    bossEyeNeutralBlinkImage.onload = () => { bossEyeNeutralBlinkReady = true; };
    let countdownAssetsRequested = false;
    let bossAssetsRequested = false;

    function ensureCountdownAssets() {
      if (countdownAssetsRequested) return;
      countdownAssetsRequested = true;
      countdown3Image.src = COUNTDOWN_3_SRC;
      countdown2Image.src = COUNTDOWN_2_SRC;
      countdown1Image.src = COUNTDOWN_1_SRC;
      countdownGoImage.src = COUNTDOWN_GO_SRC;
    }

    function ensureBossAssets() {
      if (bossAssetsRequested) return;
      bossAssetsRequested = true;
      bossEyeLeftImage.src = BOSS_EYE_LEFT_SRC;
      bossEyeRightImage.src = BOSS_EYE_RIGHT_SRC;
      bossEyeNeutralImage.src = BOSS_EYE_NEUTRAL_SRC;
      bossEyeLeftBlinkImage.src = BOSS_EYE_LEFT_BLINK_SRC;
      bossEyeRightBlinkImage.src = BOSS_EYE_RIGHT_BLINK_SRC;
      bossEyeNeutralBlinkImage.src = BOSS_EYE_NEUTRAL_BLINK_SRC;
    }
    const stopOwnedPongAudio = () => pongAudio.stopAll();
    window.__glitchPongStopAudio = stopOwnedPongAudio;
    state.listeners.push(() => {
      stopOwnedPongAudio();
      if (window.__glitchPongStopAudio === stopOwnedPongAudio) {
        window.__glitchPongStopAudio = null;
      }
    });
    if (audioUserInitiated) pongAudio.primeFromGesture();

    function getHeatRatio() {
      return Math.max(0, Math.min(1, heat / HEAT_MAX));
    }

    function ownerColor(owner, alpha = 1) {
      return `rgba(${ownerRgb(owner)},${alpha})`;
    }

    async function onlineApi(path, body) {
      const response = await fetch(path, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body || {}) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to reach the multiplayer server.");
      return payload;
    }

    function applyOnlineSnapshot(snapshot) {
      if (!snapshot || !snapshot.ball || !canvas.width || !canvas.height) return;
      onlineState.snapshot = snapshot;
      const scaleX = canvas.width / snapshot.width;
      const scaleY = canvas.height / snapshot.height;
      leftY = snapshot.paddles.left.y * scaleY;
      rightY = snapshot.paddles.right.y * scaleY;
      ballX = snapshot.ball.x * scaleX;
      ballY = snapshot.ball.y * scaleY;
      vx = snapshot.ball.vx * scaleX;
      vy = snapshot.ball.vy * scaleY;
      leftScore = snapshot.scores.left;
      rightScore = snapshot.scores.right;
      heat = snapshot.heat || 0;
      ballOwner = snapshot.lastHit === "left" ? "blue" : snapshot.lastHit === "right" ? "red" : "neutral";
      roundFrozen = snapshot.status !== "playing";
      if (snapshot.status === "ended") { gameOver = true; winner = snapshot.winner === "left" ? "LEFT" : "RIGHT"; }
    }

    function onlineSendInput(direction) {
      if (!onlineState.active || !onlineState.socket || onlineState.input === direction) return;
      onlineState.input = direction;
      onlineState.socket.emit("input:move", { direction });
    }

    function disconnectOnline() {
      if (onlineState.socket) onlineState.socket.disconnect();
      onlineState.active = false;
      onlineState.socket = null;
      onlineState.session = null;
      onlineState.snapshot = null;
      onlineState.input = "stop";
      onlineState.ended = false;
      onlineState.reconnecting = false;
      onlineState.statsRecorded = false;
    }

    function connectOnline(response) {
      if (!window.io) throw new Error("Multiplayer server is unavailable. Start the game with npm start.");
      if (onlineState.socket) onlineState.socket.disconnect();
      onlineState.session = response;
      try { localStorage.setItem("glitchPongResume", JSON.stringify({ code:response.joinCode, resumeToken:response.resumeToken })); } catch (error) {}
      const socket = window.io({ auth:{ joinTicket:response.joinTicket }, transports:["websocket", "polling"], reconnection:false });
      onlineState.socket = socket;
      socket.on("connect_error", error => showOnlineError(error.message || "Connection failed."));
      socket.on("error:message", message => showOnlineError(message));
      socket.on("lobby:joined", payload => { onlineState.session.lobbyState = payload.lobbyState; showOnlineLobby(payload.lobbyState); });
      socket.on("lobby:player_list", lobby => { onlineState.session.lobbyState = lobby; refreshOnlineLobby(lobby); });
      socket.on("lobby:locked", lobby => { onlineState.session.lobbyState = lobby; refreshOnlineLobby(lobby); });
      socket.on("state:snapshot", applyOnlineSnapshot);
      socket.on("match:start", payload => beginOnlineMatch(payload.state));
      socket.on("match:end", payload => { applyOnlineSnapshot(payload.state); recordOnlineMatchStats(payload.state); onlineState.ended = true; showOnlineError(`${payload.winner === "left" ? "LEFT" : "RIGHT"} PLAYER WINS`); });
      socket.on("player:disconnected", () => showOnlineError("Opponent disconnected. Waiting for reconnection..."));
      socket.on("player:reconnected", () => showOnlineError("Opponent reconnected."));
      socket.on("disconnect", async reason => {
        if (!onlineState.active || onlineState.reconnecting || reason === "io client disconnect") return;
        onlineState.reconnecting = true;
        showOnlineError("Connection interrupted. Restoring session...");
        try {
          const restored = await onlineApi("/api/rejoin", { code:response.joinCode, resumeToken:response.resumeToken });
          onlineState.reconnecting = false;
          connectOnline(restored);
        } catch (error) {
          onlineState.reconnecting = false;
          showOnlineError("Reconnect failed. Return to the lobby and join again.");
        }
      });
    }

    function beginOnlineMatch(snapshot) {
      ensureCountdownAssets();
      onlineState.active = true;
      onlineState.ended = false;
      onlineState.statsRecorded = false;
      twoPlayerMode = true;
      aiVsAiMode = false;
      bossEncounteredThisMatch = false;
      modeSelected = true;
      currentScreen = "game";
      isPaused = false;
      gameOver = false;
      countdownActive = false;
      roundFrozen = false;
      clearGlitchWalls();
      applyOnlineSnapshot(snapshot);
      const arena = getArena();
      if (arena.cleanup) arena.cleanup();
      if (arena.init) arena.init();
      pongAudio.stopMenuMusic();
      pongAudio.startMusic();
      GlitchProgression.beginMatch();
      matchStartLevel = GlitchProgression.level;
      syncUiForScreen();
    }

    function recordOnlineMatchStats(snapshot) {
      if (onlineState.statsRecorded || !onlineState.session || !snapshot || !snapshot.scores) return;
      const side = onlineState.session.side;
      const playerScore = side === "left" ? snapshot.scores.left : snapshot.scores.right;
      const opponentScore = side === "left" ? snapshot.scores.right : snapshot.scores.left;
      GlitchProgression.endMatch(snapshot.winner === side, false, { arenaId: currentArenaId, playerScore, opponentScore });
      onlineState.statsRecorded = true;
    }

    function getOwnerState(owner) {
      return owner === "blue" ? powerState.blue : powerState.red;
    }

    function clearPowerStates() {
      powerState.blue.shieldTimer = 0;
      powerState.blue.powerStrikeReady = false;
      powerState.blue.splitReady = false;
      powerState.red.shieldTimer = 0;
      powerState.red.powerStrikeReady = false;
      powerState.red.splitReady = false;
      arenaPowerup = null;
      powerupSpawnCooldown = 520 + Math.floor(Math.random() * 220);
      ballOwner = "neutral";
    }

    function grantPowerup(owner, type) {
      if (owner !== "blue" && owner !== "red") return;
      const state = getOwnerState(owner);
      if (type === "shield") {
        state.shieldTimer = 9999;
      } else if (type === "power") {
        state.powerStrikeReady = true;
      } else if (type === "split") {
        state.splitReady = true;
      }
      glitchPulse = Math.max(glitchPulse, 14);
      triggerCameraKick(owner === "blue" ? -8 : 8, 0, 0.012);
      pongAudio.glitch();
      awardXP(GlitchProgression.XP_REWARDS.powerupPickup, "powerupPickup", owner === "blue" ? leftX + 40 : rightX - 40, canvas.height * 0.5);
      // Quantum Cache perk: chance to immediately spawn another powerup
      if (GlitchProgression.hasPerk("quantum") && Math.random() < GlitchProgression.getPerkStat("quantumCache")) {
        powerupSpawnCooldown = Math.floor(Math.random() * 90) + 30;
      }
    }

    function spawnArenaPowerup() {
      if (arenaPowerup || roundFrozen || !modeSelected) return;
      arenaPowerup = {
        type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)],
        x: canvas.width * (0.33 + Math.random() * 0.34),
        y: canvas.height * (0.22 + Math.random() * 0.56),
        r: POWERUP_RADIUS,
        life: 900,
        pulse: Math.random() * Math.PI * 2
      };
    }

    function updateArenaPowerup() {
      if (powerState.blue.shieldTimer > 0) powerState.blue.shieldTimer--;
      if (powerState.red.shieldTimer > 0) powerState.red.shieldTimer--;
      if (bossModeActive) {
        arenaPowerup = null;
        return;
      }

      if (arenaPowerup) {
        arenaPowerup.life--;
        arenaPowerup.pulse += 0.08;
        if (arenaPowerup.life <= 0) {
          arenaPowerup = null;
          powerupSpawnCooldown = 380 + Math.floor(Math.random() * 260);
        }
        return;
      }

      if (roundFrozen || !modeSelected) return;
      powerupSpawnCooldown--;
      if (powerupSpawnCooldown <= 0) {
        spawnArenaPowerup();
      }
    }

    function checkPowerupCollection() {
      if (!arenaPowerup || (ballOwner !== "blue" && ballOwner !== "red")) return;
      const dx = ballX - arenaPowerup.x;
      const dy = ballY - arenaPowerup.y;
      const rr = (10 + arenaPowerup.r) * (10 + arenaPowerup.r);
      if (dx * dx + dy * dy <= rr) {
        grantPowerup(ballOwner, arenaPowerup.type);
        arenaPowerup = null;
        powerupSpawnCooldown = 520 + Math.floor(Math.random() * 260);
      }
    }

    function spawnSplitDecoys(direction) {
      const speed = Math.max(5.2, Math.hypot(vx, vy));
      const baseAngle = Math.atan2(vy, vx);
      const origBallY = ballY;
      const lanes = [
        { y: -24, angle: -0.27 },
        { y:   0, angle:  0    },
        { y:  24, angle:  0.27 }
      ];
      // Randomly pick which lane the real ball takes (not always middle)
      const realLane = Math.floor(Math.random() * 3);
      const real = lanes[realLane];

      // Move the real ball to its chosen lane
      ballX += direction * 10;
      ballY = clamp(origBallY + real.y, BALL_R + 4, canvas.height - BALL_R - 4);
      vx = Math.cos(baseAngle + real.angle) * speed;
      vy = Math.sin(baseAngle + real.angle) * speed;

      // Spawn solid-looking decoys at the other two lanes
      lanes.forEach((lane, i) => {
        if (i === realLane) return;
        decoys.push({
          x: ballX,
          y: clamp(origBallY + lane.y, BALL_R + 4, canvas.height - BALL_R - 4),
          vx: Math.cos(baseAngle + lane.angle) * speed * 0.97,
          vy: Math.sin(baseAngle + lane.angle) * speed * 0.97,
          life: 400,
          maxLife: 400
        });
      });
      while (decoys.length > 5) decoys.shift();
    }

    function resetGlitchState() {
      ballTrail = [];
      pulseFrames = 0;
      speedMultiplier = 1;
      pulseCooldown = 240 + Math.floor(Math.random() * 240);
      teleportCooldown = 600 + Math.floor(Math.random() * 600);
      jukeCooldown = 300 + Math.floor(Math.random() * 300);
      heat = 0;
      rallyHits = 0;
      combo = 0;
      comboTimer = 0;
      decoys = [];
      decoyCooldown = 300;
      clutchMode = false;
      cameraZoom = 1;
      cameraTargetZoom = 1;
      cameraKickX = 0;
      cameraKickY = 0;
      cameraDriftX = 0;
      cameraDriftY = 0;
      impactFreezeFrames = 0;
      leftDashCooldown = 0;
      rightDashCooldown = 0;
      leftDashTrail = [];
      rightDashTrail = [];
      rallyHeatAudio = 0;
      bossModeActive = false;
      bossTriggeredThisRally = false;
      bossPhase = BOSS_PHASES.ALARM;
      bossPhaseTimer = 0;
      bossOutcome = null;
      bossData = null;
      clearPowerStates();
      resetBlackHoleNexusGameplay();
      Object.values(aiTrackingState).forEach((tracking) => {
        tracking.wasApproaching = false;
        tracking.aimError = 0;
        tracking.trackedY = null;
        tracking.reactionTimer = 0;
      });
      pongAudio.setIntensity(0);
    }

    function dashCooldownRatio(frames) {
      return Math.max(0, Math.min(1, frames / DASH_COOLDOWN_MAX));
    }

    function performPaddleDash(side, direction) {
      if (!direction) return;
      const heatRatio = getHeatRatio();
      // Above 50% Heat the arena overclocks dashes. The boost is deliberately
      // modest: 76px at/below 50%, rising smoothly to 90px at maximum Heat.
      const highHeatDash = Math.max(0, (heatRatio - 0.5) * 2);
      const dashDistance = DASH_DISTANCE + highHeatDash * 14;
      const dashKick = 8 + highHeatDash * 8;
      const dashCooldown = Math.max(
        24,
        Math.round(DASH_COOLDOWN_MAX * (1 - GlitchProgression.getPerkStat("dashCooldownMult"))) - Math.floor(highHeatDash * 8)
      );
      const trailScale = dashDistance / DASH_DISTANCE;
      if (side === "left") {
        if (leftDashCooldown > 0) return;
        leftY = clamp(leftY + direction * dashDistance, 0, canvas.height - paddleH);
        leftDashCooldown = dashCooldown;
        leftDashTrail = [
          { x: leftX, y: leftY - direction * 18 * trailScale, life: 8 },
          { x: leftX, y: leftY - direction * 40 * trailScale, life: 12 },
          { x: leftX, y: leftY - direction * 62 * trailScale, life: 16 }
        ];
        glitchPulse = Math.max(glitchPulse, 8 + Math.floor(highHeatDash * 10));
        triggerCameraKick(6 + highHeatDash * 7, direction * dashKick * 0.45, 0.006 + highHeatDash * 0.010);
        impactFreezeFrames = Math.max(impactFreezeFrames, 1);
        if (modeSelected) pongAudio.dash();
        awardXP(GlitchProgression.XP_REWARDS.dashUse, "dashUse", leftX + 30, leftY);
        if (!aiVsAiMode) GlitchProgression.trackDash();
        return;
      }

      if (side !== "right" || rightDashCooldown > 0) return;
      rightY = clamp(rightY + direction * dashDistance, 0, canvas.height - paddleH);
      rightDashCooldown = dashCooldown;
      rightDashTrail = [
        { x: rightX, y: rightY - direction * 18 * trailScale, life: 8 },
        { x: rightX, y: rightY - direction * 40 * trailScale, life: 12 },
        { x: rightX, y: rightY - direction * 62 * trailScale, life: 16 }
      ];
      glitchPulse = Math.max(glitchPulse, 8 + Math.floor(highHeatDash * 10));
      triggerCameraKick(-(6 + highHeatDash * 7), direction * dashKick * 0.45, 0.006 + highHeatDash * 0.010);
      impactFreezeFrames = Math.max(impactFreezeFrames, 1);
      if (modeSelected) pongAudio.dash();
      awardXP(GlitchProgression.XP_REWARDS.dashUse, "dashUse", rightX - 30, rightY);
      if (!aiVsAiMode) GlitchProgression.trackDash();
    }

    function updateAiPaddle(side = "right", options = {}) {
      const isMenuDemo = !!options.isMenuDemo;
      const targetBallX = typeof options.ballX === "number" ? options.ballX : ballX;
      const targetBallY = typeof options.ballY === "number" ? options.ballY : ballY;
      const targetVx = typeof options.vx === "number" ? options.vx : vx;
      const targetVy = typeof options.vy === "number" ? options.vy : vy;
      const paddleY = side === "left" ? leftY : rightY;
      const paddleCenter = paddleY + paddleH / 2;
      const movingTowardPaddle = side === "left" ? targetVx < 0 : targetVx > 0;
      const courtEdge = side === "left" ? leftX + paddleW : rightX;
      const distanceToPaddle = Math.abs(targetBallX - courtEdge);
      const travelFrames = Math.max(1, distanceToPaddle / Math.max(1, Math.abs(targetVx || 1)));
      const retreatTarget = canvas.height * 0.5;

      // ── Difficulty profile ───────────────────────────────────────────────
      // isMenuDemo always uses its own neutral settings.
      let smoothing, errorRange, canDash, dashThresholdMult, dashWindowMult, retreatBias;
      let predictionFrames, reactionFrames, maxStep, mistakeChance;
      if (isMenuDemo) {
        smoothing = 0.11; errorRange = 0; canDash = true; dashThresholdMult = 1; dashWindowMult = 1; retreatBias = 0.25;
        predictionFrames = 22; reactionFrames = 1; maxStep = 12; mistakeChance = 0;
      } else {
        switch (aiDifficulty) {
          case "easy":
            smoothing = 0.030;           // very sluggish tracking
            errorRange = paddleH * 0.42; // persistent error for the incoming shot
            canDash = false;             // no AI dashing on Easy
            dashThresholdMult = 99;      // effectively disabled anyway
            dashWindowMult = 0;
            retreatBias = 0.60;          // retreats heavily to center
            predictionFrames = 6;
            reactionFrames = 9;
            maxStep = 3.4;
            mistakeChance = 0.24;
            break;
          case "hard":
            smoothing = 0.085 + getHeatRatio() * 0.02 + Math.min(0.022, (GlitchProgression.level - 1) * 0.0008);
            errorRange = 0;
            canDash = true;
            dashThresholdMult = 1;
            dashWindowMult = 1;
            retreatBias = 0.25;
            predictionFrames = 22;
            reactionFrames = 1;
            maxStep = 10.5 + getHeatRatio() * 1.5;
            mistakeChance = 0;
            break;
          default: // "medium"
            smoothing = 0.046 + getHeatRatio() * 0.006 + Math.min(0.006, (GlitchProgression.level - 1) * 0.0002);
            errorRange = paddleH * Math.max(0.22, 0.32 - GlitchProgression.level * 0.0015);
            canDash = true;
            dashThresholdMult = 1.75;
            dashWindowMult = 0.50;
            retreatBias = 0.42;
            predictionFrames = 12;
            reactionFrames = Math.max(3, 5 - Math.floor(getHeatRatio() * 2));
            maxStep = 6.1 + getHeatRatio() * 0.7 + Math.min(0.45, (GlitchProgression.level - 1) * 0.009);
            mistakeChance = Math.max(0.09, 0.14 - GlitchProgression.level * 0.001);
        }
      }

      const predictedY = clamp(
        targetBallY + targetVy * Math.min(predictionFrames, travelFrames),
        paddleH * 0.5,
        canvas.height - paddleH * 0.5
      );
      const tracking = aiTrackingState[side];

      // Easy and Medium make one imperfect read as the ball starts travelling
      // toward them. Keeping that read stable prevents frame-by-frame random
      // errors from averaging back into near-perfect tracking.
      if (movingTowardPaddle && !tracking.wasApproaching) {
        const deliberateMistake = !isMenuDemo && mistakeChance > 0 && Math.random() < mistakeChance;
        if (deliberateMistake) {
          const missDirection = Math.random() < 0.5 ? -1 : 1;
          tracking.aimError = missDirection * paddleH * (0.68 + Math.random() * 0.16);
        } else {
          tracking.aimError = errorRange > 0 ? (Math.random() * 2 - 1) * errorRange : 0;
        }
        tracking.reactionTimer = 0;
        tracking.wasApproaching = true;
      } else if (!movingTowardPaddle) {
        tracking.wasApproaching = false;
        tracking.aimError = 0;
      }

      if (tracking.reactionTimer <= 0 || tracking.trackedY === null) {
        tracking.trackedY = movingTowardPaddle
          ? predictedY + tracking.aimError
          : predictedY * (1 - retreatBias) + retreatTarget * retreatBias;
        tracking.reactionTimer = reactionFrames;
      } else {
        tracking.reactionTimer -= 1;
      }

      const targetCenter = tracking.trackedY;
      const desiredStep = (targetCenter - paddleCenter) * smoothing;
      const nextY = paddleY + clamp(desiredStep, -maxStep, maxStep);
      if (side === "left") leftY = nextY;
      else rightY = nextY;

      // Dash decision
      if (canDash) {
        const offset = targetCenter - paddleCenter;
        const dashWindow = movingTowardPaddle && distanceToPaddle < canvas.width * 0.18 * dashWindowMult;
        const dashNeeded = Math.abs(offset) > paddleH * 0.30 * dashThresholdMult;
        if (dashWindow && dashNeeded && aiDashDecisionCooldown <= 0) {
          const direction = offset > 0 ? 1 : -1;
          performPaddleDash(side, direction);
          aiDashDecisionCooldown = isMenuDemo ? 14 : Math.max(12, 20 - Math.floor(getHeatRatio() * 8));
        }
      }
    }

    function resetMenuDemo() {
      leftY = canvas.height / 2 - paddleH / 2;
      rightY = canvas.height / 2 - paddleH / 2;
      leftScore = 0;
      rightScore = 0;
      winner = null;
      gameOver = false;
      finalScoreCinematic = false;
      finalScoreCinematicTimer = 0;
      countdownActive = false;
      countdownPhaseIndex = -1;
      countdownFrame = 0;
      roundFrozen = false;
      pendingLaunchDir = Math.random() > 0.5 ? 1 : -1;
      ballX = canvas.width / 2;
      ballY = canvas.height * (0.34 + Math.random() * 0.32);
      vx = (Math.random() > 0.5 ? 1 : -1) * (5.2 + Math.random() * 0.8);
      vy = (Math.random() * 3.6) - 1.8;
      if (Math.abs(vy) < 0.9) vy = vy < 0 ? -1.1 : 1.1;
      aiDashDecisionCooldown = 12;
      menuDemoResetCooldown = 0;
      resetGlitchState();
    }

    function updateMenuDemo() {
      if (menuDemoResetCooldown > 0) {
        menuDemoResetCooldown -= 1;
        if (menuDemoResetCooldown === 0) resetMenuDemo();
      }

      if (aiDashDecisionCooldown > 0) aiDashDecisionCooldown -= 1;
      if (leftDashCooldown > 0) leftDashCooldown -= 1;
      if (rightDashCooldown > 0) rightDashCooldown -= 1;
      leftDashTrail = leftDashTrail.map((trail) => ({ ...trail, life: trail.life - 1 })).filter((trail) => trail.life > 0);
      rightDashTrail = rightDashTrail.map((trail) => ({ ...trail, life: trail.life - 1 })).filter((trail) => trail.life > 0);

      updateAiPaddle("left", { isMenuDemo: true });
      updateAiPaddle("right", { isMenuDemo: true });

      leftY = clamp(leftY, 0, canvas.height - paddleH);
      rightY = clamp(rightY, 0, canvas.height - paddleH);

      if (menuDemoResetCooldown > 0) return;

      heat = Math.min(HEAT_MAX, Math.max(10, heat * 0.992 + 0.18));
      ballX += vx;
      ballY += vy;

      ballTrail.unshift({ x: ballX, y: ballY });
      if (ballTrail.length > ghostTrailLimit) ballTrail.pop();

      if (ballY <= BALL_R || ballY >= canvas.height - BALL_R) {
        vy *= -1;
        ballY = clamp(ballY, BALL_R, canvas.height - BALL_R);
        glitchPulse = Math.max(glitchPulse, 4);
      }

      if (ballX <= leftX + paddleW && ballY >= leftY - 6 && ballY <= leftY + paddleH + 6 && vx < 0) {
        vx = Math.abs(vx) * (1.01 + Math.random() * 0.04);
        vy += (ballY - (leftY + paddleH / 2)) * 0.035;
        ballOwner = "blue";
        combo = Math.min(combo + 1, 12);
        comboTimer = COMBO_MAX_TIME;
        rallyHits += 1;
        glitchPulse = Math.max(glitchPulse, 6);
        impactFreezeFrames = 0;
      }

      if (ballX >= rightX && ballY >= rightY - 6 && ballY <= rightY + paddleH + 6 && vx > 0) {
        vx = -Math.abs(vx) * (1.01 + Math.random() * 0.04);
        vy += (ballY - (rightY + paddleH / 2)) * 0.035;
        ballOwner = "red";
        combo = Math.min(combo + 1, 12);
        comboTimer = COMBO_MAX_TIME;
        rallyHits += 1;
        glitchPulse = Math.max(glitchPulse, 6);
        impactFreezeFrames = 0;
      }

      if (ballX < -24 || ballX > canvas.width + 24) {
        menuDemoResetCooldown = 18;
        ballTrail = [];
        glitchPulse = Math.max(glitchPulse, 10);
      }

      if (comboTimer > 0) comboTimer -= 1;
      else combo = 0;
      glitchPulse = Math.max(0, glitchPulse - 1);
      pulseFrames = 0;
      speedMultiplier = 1;
      decoys = [];
      arenaPowerup = null;
    }

    function getCountdownImage(key) {
      if (key === "3") return countdown3Image;
      if (key === "2") return countdown2Image;
      if (key === "1") return countdown1Image;
      return countdownGoImage;
    }

    function isMatchPoint() {
      return !gameOver && (leftScore >= WIN_SCORE - 1 || rightScore >= WIN_SCORE - 1);
    }

    function startRoundCountdown() {
      ensureCountdownAssets();
      countdownActive = true;
      countdownPhaseIndex = 0;
      countdownFrame = 0;
      roundFrozen = true;
      vx = 0;
      vy = 0;
      const phase = COUNTDOWN_PHASES[countdownPhaseIndex];
      if (phase.key === "3") pongAudio.countdown3();
      else if (phase.key === "2") pongAudio.countdown2();
      else if (phase.key === "1") pongAudio.countdown1();
      else if (phase.key === "GO") pongAudio.countdownGo();
    }

    function advanceCountdownPhase() {
      countdownPhaseIndex += 1;
      countdownFrame = 0;
      if (countdownPhaseIndex < COUNTDOWN_PHASES.length) {
        const phase = COUNTDOWN_PHASES[countdownPhaseIndex];
        if (phase.key === "3") pongAudio.countdown3();
        else if (phase.key === "2") pongAudio.countdown2();
        else if (phase.key === "1") pongAudio.countdown1();
        else if (phase.key === "GO") pongAudio.countdownGo();
      } else {
        launchBallToPlayer();
      }
    }

    function updateCountdown() {
      if (!countdownActive || countdownPhaseIndex < 0 || countdownPhaseIndex >= COUNTDOWN_PHASES.length) return;
      countdownFrame += 1;
      const phase = COUNTDOWN_PHASES[countdownPhaseIndex];
      if (countdownFrame >= phase.duration) {
        advanceCountdownPhase();
      }
    }

    function resetPositions() {
      leftY = canvas.height / 2 - paddleH / 2;
      rightY = canvas.height / 2 - paddleH / 2;
      ballX = canvas.width / 2;
      ballY = canvas.height / 2;
      vx = 6 * (Math.random() > 0.5 ? 1 : -1);
      vy = (Math.random() * 4) - 2;
      roundFrozen = true;
      resetGlitchState();
    }

    // ── Game resize handler: recalculate rightX and clamp everything ────────
    // The shell's sizeCanvas already updates canvas.width/height; we then
    // re-derive rightX and nudge paddles/ball so they stay inside the new court.
    function onGameResize() {
      // Recalculate both paddle anchors when rotation swaps the notched edge.
      refreshGameplaySafeArea();
      leftX = paddleEdgeGap + safeInsetLeft;
      rightX = canvas.width - paddleEdgeGap - safeInsetRight - paddleW;

      // Update mobile paddle height if it's percentage-based
      if (isMobileDevice) {
        paddleH = Math.round(canvas.height * 0.25);
      }

      // Clamp paddle Y positions so they're still fully on-screen
      leftY  = clamp(leftY,  0, canvas.height - paddleH);
      rightY = clamp(rightY, 0, canvas.height - paddleH);

      // Keep ball inside the new court bounds
      ballX = clamp(ballX, BALL_R, canvas.width  - BALL_R);
      ballY = clamp(ballY, BALL_R, canvas.height - BALL_R);
    }

    addListener(window, "resize", onGameResize, true);
    if (window.visualViewport) {
      addListener(window.visualViewport, "resize", onGameResize, true);
      addListener(window.visualViewport, "scroll", onGameResize, true);
    }

    function resetBall(dir = 1) {
      ballX = canvas.width / 2;
      ballY = canvas.height / 2;
      pendingLaunchDir = dir;
      vx = 0;
      vy = 0;
      roundFrozen = true;
      resetGlitchState();
    }

    function launchBallToPlayer() {
      vx = 6 * pendingLaunchDir;
      // Memory: bias vy toward a remembered miss on the side we're serving toward
      const targetMemory = pendingLaunchDir > 0 ? missMemory.right : missMemory.left;
      if (targetMemory.length > 0) {
        const rememberY = targetMemory[Math.floor(Math.random() * targetMemory.length)];
        const centerY   = canvas.height / 2;
        // Nudge vy toward the remembered gap (subtle — not a guarantee)
        const memoryPull = clamp((rememberY - centerY) / canvas.height, -0.5, 0.5) * 3.2;
        vy = clamp((Math.random() * 4) - 2 + memoryPull, -3.8, 3.8);
      } else {
        vy = (Math.random() * 4) - 2;
      }
      if (Math.abs(vy) < 1.2) vy = vy < 0 ? -1.8 : 1.8;
      countdownActive = false;
      countdownPhaseIndex = -1;
      countdownFrame = 0;
      roundFrozen = false;
      pongAudio.startMusic();
      pongAudio.gameStart();
    }

    function triggerScoreShake(dir) {
      pendingLaunchDir = dir;
      shakeFrames = 24;
      scoreFlashFrames = 22;
      breachFlashFrames = 34;
      breachSide = dir;
      glitchPulse = 26;
      roundFrozen = true;
      ballX = canvas.width / 2;
      ballY = canvas.height / 2;
      vx = 0;
      vy = 0;
      resetGlitchState();
      cameraKickX = dir * 22;
      cameraKickY = 0;
      cameraZoom = 1.035;
      cameraTargetZoom = 1.055;
      impactFreezeFrames = 2;
      pongAudio.score();
      pongAudio.glitch();
    }

    function startFinalScoreCinematic(side) {
      finalScoreCinematic = true;
      finalScoreCinematicTimer = 58;
      finalScoreSide = side;
      finalScoreTrailSnapshot = ballTrail.slice(0, 8).map((trail) => ({ ...trail }));
      finalScoreBallSnapshot = {
        x: ballX,
        y: ballY,
        vx,
        vy,
        owner: ballOwner
      };
      winner = side === "LEFT" ? "LEFT" : "RIGHT";
      roundFrozen = true;
      countdownActive = false;
      countdownPhaseIndex = -1;
      countdownFrame = 0;
      vx = 0;
      vy = 0;
      shakeFrames = 0;
      impactFreezeFrames = 0;
      scoreFlashFrames = 40;
      breachFlashFrames = 52;
      breachSide = side === "LEFT" ? -1 : 1;
      glitchPulse = Math.max(glitchPulse, 34);
      cameraKickX = side === "LEFT" ? -18 : 18;
      cameraKickY = -4;
      cameraZoom = 1.05;
      cameraTargetZoom = 1.12;
      pongAudio.score();
      pongAudio.critical();
      pongAudio.stopMenuMusic();
    }

    function createOrbitBall(angle, radius = 78) {
      return {
        angle,
        radius,
        x: canvas.width / 2 + Math.cos(angle) * radius,
        y: canvas.height / 2 + Math.sin(angle) * radius,
        active: true
      };
    }

    function refreshBossOrbitPositions(orbitSpeed = 0.028) {
      if (!bossData || !Array.isArray(bossData.orbitBalls)) return;
      for (const orb of bossData.orbitBalls) {
        if (!orb.active) continue;
        orb.angle += orbitSpeed;
        orb.x = bossData.centerX + Math.cos(orb.angle) * orb.radius;
        orb.y = bossData.centerY + Math.sin(orb.angle) * orb.radius;
      }
    }

    function chooseBossTarget() {
      if (!bossData) return Math.random() < 0.5 ? "left" : "right";
      const leftNeeds = bossData.leftHits < 3;
      const rightNeeds = bossData.rightHits < 3;
      if (leftNeeds && rightNeeds) return Math.random() < 0.5 ? "left" : "right";
      if (leftNeeds) return "left";
      if (rightNeeds) return "right";
      return Math.random() < 0.5 ? "left" : "right";
    }
    function chooseBossAimY(targetSide) {
      const topMargin = 64;
      const bottomMargin = canvas.height - 64;
      const targetPaddleY = targetSide === "left" ? leftY : rightY;
      const targetCenterY = targetPaddleY + paddleH / 2;
      const spread = Math.max(52, paddleH * 0.9);
      const bias = (Math.random() - 0.5) * spread * 1.7;
      return clamp(targetCenterY + bias, topMargin, bottomMargin);
    }

    function setBossEyeState(nextState, forceGlitch = false) {
      if (!bossData) return;
      const changed = bossData.eyeState !== nextState;
      bossData.eyeState = nextState;
      if (changed || forceGlitch) bossData.eyeGlitchFrames = 10;
    }

    // ── Pre-Boss cinematic: speech bubble → glitch → morph → boss ──────────
    function triggerPreBoss() {
      if (preBossActive || bossModeActive || bossTriggeredThisRally || bossEncounteredThisMatch) return;
      if (!modeSelected || gameOver || finalScoreCinematic) return;
      ensureBossAssets();
      bossEncounteredThisMatch = true;
      preBossActive = true;
      preBossTimer  = 0;
      preBossSnapX  = ballX;
      preBossSnapY  = ballY;
      bossTriggeredThisRally = true;
      roundFrozen = true;
      vx = 0; vy = 0;
      decoys = [];
      ballTrail = [];
      impactFreezeFrames = 0;
      pongAudio.glitch();
    }

    function updatePreBoss() {
      if (!preBossActive) return;
      preBossTimer++;
      if (preBossTimer <= PB_GLITCH && preBossTimer > PB_SPEECH) {
        if (preBossTimer % 4 === 0)
          triggerCameraKick((Math.random()-0.5)*14, (Math.random()-0.5)*8, 0.012);
        glitchPulse = Math.max(glitchPulse, 22);
      }
      if (preBossTimer >= PB_MORPH) {
        // Move ball to center so startBossFight has the right anchor
        ballX = canvas.width / 2;
        ballY = canvas.height / 2;
        preBossActive = false;
        // Reset this flag so startBossFight()'s own guard doesn't block it
        bossTriggeredThisRally = false;
        startBossFight();
      }
    }

    // Canvas pixel-art angry face inside a speech bubble
    function drawPreBossSpeechBubble(bx, by, alpha) {
      if (alpha <= 0) return;
      const PX  = 5;   // size of one pixel-art "pixel"
      const BW  = 18 * PX;  // bubble width
      const BH  = 13 * PX;  // bubble height
      const R   = 10;  // corner radius
      // Position bubble upper-right of ball
      const ox = bx + 14;
      const oy = by - BH - 18;
      ctx.save();
      ctx.globalAlpha = alpha;

      // Shadow + white background
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(ox + R, oy);
      ctx.lineTo(ox + BW - R, oy);
      ctx.quadraticCurveTo(ox + BW, oy, ox + BW, oy + R);
      ctx.lineTo(ox + BW, oy + BH - R);
      ctx.quadraticCurveTo(ox + BW, oy + BH, ox + BW - R, oy + BH);
      ctx.lineTo(ox + R, oy + BH);
      ctx.quadraticCurveTo(ox, oy + BH, ox, oy + BH - R);
      ctx.lineTo(ox, oy + R);
      ctx.quadraticCurveTo(ox, oy, ox + R, oy);
      ctx.closePath();
      ctx.fill();

      // Bubble tail → points left-down toward ball
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(ox + 4, oy + BH);
      ctx.lineTo(bx + 2, by);
      ctx.lineTo(ox + 22, oy + BH);
      ctx.fill();

      // Pixel-art angry face in black
      ctx.fillStyle = "#111";
      // Left eyebrow: steps down toward center-right
      [[1,1],[1,2],[2,2],[2,3],[3,3],[3,4],[4,4],[5,4]].forEach(([c,r]) =>
        ctx.fillRect(ox + PX + c*PX, oy + PX + r*PX, PX, PX));
      // Right eyebrow: mirror
      [[16,1],[16,2],[15,2],[15,3],[14,3],[14,4],[13,4],[12,4]].forEach(([c,r]) =>
        ctx.fillRect(ox + c*PX, oy + PX + r*PX, PX, PX));
      // Mouth: flat stern bar
      for (let c = 4; c <= 13; c++)
        ctx.fillRect(ox + c*PX, oy + 9*PX, PX, PX);

      ctx.restore();
    }

    function drawBlackHoleBossCinematic(t, cx, cy) {
      const pullEnd = PB_GLITCH;
      const morphStart = PB_GLITCH;
      const f = blackHoleState.frame + t;
      ctx.save();

      if (t <= pullEnd) {
        const p = Math.min(1, t / pullEnd);
        const ease = 1 - Math.pow(1 - p, 2.4);
        const bx = preBossSnapX + (cx - preBossSnapX) * ease + Math.sin(f * 0.22) * 8 * (1 - p);
        const by = preBossSnapY + (cy - preBossSnapY) * ease + Math.cos(f * 0.18) * 6 * (1 - p);
        const ringR = 54 + p * Math.min(canvas.width, canvas.height) * 0.22;

        ctx.strokeStyle = `rgba(177,0,211,${0.28 + p * 0.34})`;
        ctx.lineWidth = 2 + p * 3;
        ctx.shadowColor = "rgba(177,0,211,0.9)";
        ctx.shadowBlur = 22 + p * 28;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + f * 0.045;
          const r1 = 38 + p * 38;
          const r2 = ringR * (0.8 + Math.random() * 0.22);
          ctx.strokeStyle = i % 2 ? `rgba(225,120,255,${0.12 + p * 0.16})` : `rgba(177,0,211,${0.14 + p * 0.18})`;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          ctx.stroke();
        }

        ctx.globalAlpha = 1 - p * 0.35;
        ctx.beginPath();
        ctx.arc(bx, by, BALL_R + 2 + p * 3, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(177,0,211,0.95)";
        ctx.shadowBlur = 28;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      } else {
        const p = Math.min(1, (t - morphStart) / (PB_MORPH - morphStart));
        const eject = Math.sin(Math.min(1, p * 1.15) * Math.PI);
        const eyeScale = 1.1 + p * 4.8 + eject * 0.45;
        const burstR = 70 + p * Math.min(canvas.width, canvas.height) * 0.26;

        ctx.fillStyle = `rgba(0,0,0,${0.58 + p * 0.22})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 56 + p * 36, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255,255,255,${0.22 * (1 - p) + 0.10})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, burstR, 0, Math.PI * 2);
        ctx.stroke();

        if (bossEyeNeutralReady) {
          const ew = BALL_R * 2 * eyeScale * 2.25;
          const eh = ew * 0.52;
          ctx.globalAlpha = Math.min(1, p * 1.8);
          ctx.shadowColor = `rgba(177,0,211,${0.65 + p * 0.35})`;
          ctx.shadowBlur = 44 + p * 34;
          ctx.drawImage(bossEyeNeutralImage, cx - ew / 2, cy - eh / 2, ew, eh);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();
    }

    function drawPreBoss() {
      if (!preBossActive) return;
      const t   = preBossTimer;
      const cx  = canvas.width  / 2;
      const cy  = canvas.height / 2;
      ctx.save();

      if (currentArenaId === "blackhole") {
        drawBlackHoleBossCinematic(t, cx, cy);
        ctx.restore();
        return;
      }

      /* ── Phase 1: Ball frozen + speech bubble (0 → PB_SPEECH) ── */
      if (t <= PB_SPEECH) {
        const p = t / PB_SPEECH;
        // Ball glow at frozen position
        ctx.beginPath();
        ctx.arc(preBossSnapX, preBossSnapY, BALL_R + 2, 0, Math.PI * 2);
        ctx.fillStyle = "#67efff";
        ctx.shadowColor = "rgba(103,239,255,0.9)";
        ctx.shadowBlur = 22;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Speech bubble fades in fast, stays
        drawPreBossSpeechBubble(preBossSnapX, preBossSnapY, Math.min(1, p * 3));
      }

      /* ── Phase 2: Ball glitches to center (PB_SPEECH → PB_GLITCH) ── */
      else if (t <= PB_GLITCH) {
        const p  = (t - PB_SPEECH) / (PB_GLITCH - PB_SPEECH);
        const bx = preBossSnapX + (cx - preBossSnapX) * p + (Math.random()-0.5)*30*(1-p);
        const by = preBossSnapY + (cy - preBossSnapY) * p + (Math.random()-0.5)*30*(1-p);
        // RGB split ghost
        const off = 5 * (1-p);
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.arc(bx-off, by, BALL_R+2, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255,0,100,0.9)"; ctx.fill();
        ctx.beginPath(); ctx.arc(bx+off, by, BALL_R+2, 0, Math.PI*2);
        ctx.fillStyle = "rgba(0,255,255,0.9)"; ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(bx, by, BALL_R+2, 0, Math.PI*2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(255,255,255,0.9)"; ctx.shadowBlur = 28;
        ctx.fill(); ctx.shadowBlur = 0;
        // Bubble fades out quickly as ball leaves
        drawPreBossSpeechBubble(preBossSnapX, preBossSnapY, Math.max(0, 1 - p*3));
      }

      /* ── Phase 3: Ball morphs into boss eye at center (PB_GLITCH → PB_MORPH) ── */
      else {
        const p = (t - PB_GLITCH) / (PB_MORPH - PB_GLITCH);
        const ballAlpha = Math.max(0, 1 - p * 2.2);
        const eyeAlpha  = Math.min(1, (p - 0.1) * 1.6);
        const eyeScale  = 1 + p * 4.5;

        // Expanding red corona
        ctx.beginPath();
        ctx.arc(cx, cy, BALL_R * eyeScale * 1.4, 0, Math.PI*2);
        ctx.fillStyle = `rgba(200,30,30,${0.18 * p})`;
        ctx.fill();

        // Eye image morphs in
        if (bossEyeNeutralReady && eyeAlpha > 0) {
          const ew = BALL_R * 2 * eyeScale * 2.2;
          const eh = ew * 0.52;
          ctx.globalAlpha = eyeAlpha;
          ctx.shadowColor = `rgba(255,30,30,${eyeAlpha})`;
          ctx.shadowBlur  = 50 * eyeAlpha;
          ctx.drawImage(bossEyeNeutralImage, cx - ew/2, cy - eh/2, ew, eh);
          ctx.shadowBlur  = 0;
          ctx.globalAlpha = 1;
        }

        // Ball fades out at center
        if (ballAlpha > 0) {
          ctx.globalAlpha = ballAlpha;
          ctx.beginPath(); ctx.arc(cx, cy, BALL_R+2, 0, Math.PI*2);
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(255,255,255,0.9)"; ctx.shadowBlur = 24;
          ctx.fill(); ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }

    function startBossFight() {
      if (bossModeActive || bossTriggeredThisRally || !modeSelected || gameOver || finalScoreCinematic) return;
      bossModeActive = true;
      bossTriggeredThisRally = true;
      bossPhase = BOSS_PHASES.ALARM;
      bossPhaseTimer = 96;
      bossOutcome = null;
      roundFrozen = true;
      countdownActive = false;
      countdownPhaseIndex = -1;
      countdownFrame = 0;
      arenaPowerup = null;
      decoys = [];
      pulseFrames = 0;
      speedMultiplier = 1;
      vx = 0;
      vy = 0;
      impactFreezeFrames = 0;
      shakeFrames = 0;
      glitchPulse = Math.max(glitchPulse, 26);
      triggerCameraKick((Math.random() - 0.5) * 10, -4, 0.04);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const orbitBalls = [];
      for (let i = 0; i < 6; i++) {
        orbitBalls.push(createOrbitBall((Math.PI * 2 * i) / 6));
      }

      bossData = {
        introBallX: ballX,
        introBallY: ballY,
        centerX,
        centerY,
        eyeState: "neutral",
        eyeGlitchFrames: 12,
        // Blink frames run at 60fps: 8–16 frames = 0.13–0.27 seconds,
        // comfortably inside a natural 0.1–0.4 second blink.
        blinkFrames: 0,
        blinkCooldown: 105 + Math.floor(Math.random() * 150),
        leftHits: 0,
        rightHits: 0,
        successfulReturns: 0,
        throwsResolved: 0,
        orbitBalls,
        projectile: null,
        currentTarget: null,
        currentAimY: centerY,
        currentOrbitIndex: -1,
        failedSide: null,
        hitFlash: 0,
        alarmFlash: 0,
        outroBallGrow: 0
      };

      ballTrail = [{ x: ballX, y: ballY }];
      pongAudio.critical();
      pongAudio.glitch();
    }

    function finishBossFightWithScore() {
      if (!bossModeActive || !bossOutcome) return;
      const awardSide = bossOutcome && bossOutcome.awardSide ? bossOutcome.awardSide : "right";

      const freezeAtCenter = () => {
        ballX = canvas.width / 2;
        ballY = canvas.height / 2;
        vx = 0;
        vy = 0;
        ballOwner = "neutral";
        ballTrail = [];
        decoys = [];
        arenaPowerup = null;
        pulseFrames = 0;
        speedMultiplier = 1;
        heat = 0;
        rallyHits = 0;
        combo = 0;
        comboTimer = 0;
        pongAudio.setIntensity(0);
      };

      if (bossOutcome.type === "fail") {
        if (awardSide === "left") {
          leftScore += 2;
          if (leftScore >= WIN_SCORE) {
            leftScore = Math.max(leftScore, WIN_SCORE);
            bossModeActive = false;
            bossData = null;
            bossOutcome = null;
            startFinalScoreCinematic("LEFT");
            return;
          }
        } else {
          rightScore += 2;
          if (rightScore >= WIN_SCORE) {
            rightScore = Math.max(rightScore, WIN_SCORE);
            bossModeActive = false;
            bossData = null;
            bossOutcome = null;
            startFinalScoreCinematic("RIGHT");
            return;
          }
        }

        freezeAtCenter();
        bossModeActive = false;
        bossData = null;
        bossOutcome = null;
        scoreFlashFrames = Math.max(scoreFlashFrames, 20);
        breachFlashFrames = Math.max(breachFlashFrames, 22);
        breachSide = awardSide === "left" ? -1 : 1;
        pongAudio.score();
        startRoundCountdown();
        return;
      }

      if (bossOutcome.type === "success") {
        // A full six-fireball defense is a draw: it ends the boss phase without
        // changing either score. The reward is survival/X P, not free points.
        awardXP(GlitchProgression.XP_REWARDS.bossSurvival, "bossSurvival", canvas.width / 2, canvas.height * 0.3);
        if (!aiVsAiMode) GlitchProgression.trackBossSurvival();
        // Emergency Restore perk: boss survival refreshes Dash
        if (GlitchProgression.hasPerk("emergency")) {
          leftDashCooldown  = 0;
          rightDashCooldown = 0;
        }

        freezeAtCenter();
        bossModeActive = false;
        bossData = null;
        bossOutcome = null;
        scoreFlashFrames = Math.max(scoreFlashFrames, 16);
        breachFlashFrames = Math.max(breachFlashFrames, 18);
        clearGlitchWalls();
        breachSide = 0;
        pongAudio.score();
        startRoundCountdown();
      }
    }

    function updateBossFight() {
      if (!bossModeActive || !bossData) return;

      const heatRatio = getHeatRatio();
      bossData.alarmFlash += 0.14;
      if (bossData.hitFlash > 0) bossData.hitFlash -= 1;
      if (bossData.eyeGlitchFrames > 0) bossData.eyeGlitchFrames -= 1;
      if (bossPhase !== BOSS_PHASES.ALARM) {
        if (bossData.blinkFrames > 0) {
          bossData.blinkFrames -= 1;
        } else if (--bossData.blinkCooldown <= 0) {
          bossData.blinkFrames = 8 + Math.floor(Math.random() * 9);
          bossData.blinkCooldown = 110 + Math.floor(Math.random() * 190);
        }
      }
      refreshBossOrbitPositions(bossPhase === BOSS_PHASES.THROW ? 0.05 : 0.03);

      if (bossPhase === BOSS_PHASES.ALARM) {
        bossPhaseTimer -= 1;
        scoreFlashFrames = Math.max(scoreFlashFrames, 1);
        breachFlashFrames = Math.max(breachFlashFrames, 2);
        breachSide = Math.sin(bossData.alarmFlash) >= 0 ? -1 : 1;
        triggerCameraKick((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, 0.002);
        if (bossPhaseTimer % 24 === 0) pongAudio.critical();
        if (bossPhaseTimer <= 0) {
          bossPhase = BOSS_PHASES.CENTER_GLITCH;
          bossPhaseTimer = 28;
          pongAudio.glitch();
        }
        return;
      }

      if (bossPhase === BOSS_PHASES.CENTER_GLITCH) {
        bossPhaseTimer -= 1;
        const t = 1 - Math.max(0, bossPhaseTimer) / 28;
        const snap = bossPhaseTimer % 3 === 0 ? 1 : 0;
        ballX += (bossData.centerX - ballX) * (0.16 + t * 0.32);
        ballY += (bossData.centerY - ballY) * (0.16 + t * 0.32);
        if (snap) {
          ballX += (Math.random() - 0.5) * (10 + heatRatio * 6);
          ballY += (Math.random() - 0.5) * (8 + heatRatio * 4);
        }
        glitchPulse = Math.max(glitchPulse, 18);
        if (bossPhaseTimer <= 0) {
          ballX = bossData.centerX;
          ballY = bossData.centerY;
          bossPhase = BOSS_PHASES.MATERIALIZE;
          bossPhaseTimer = 26;
          pongAudio.glitch();
        }
        return;
      }

      if (bossPhase === BOSS_PHASES.MATERIALIZE) {
        bossPhaseTimer -= 1;
        ballX = bossData.centerX;
        ballY = bossData.centerY;
        glitchPulse = Math.max(glitchPulse, 12);
        if (bossPhaseTimer <= 0) {
          bossPhase = BOSS_PHASES.AIM;
          bossPhaseTimer = 36;
          bossData.currentTarget = chooseBossTarget();
          bossData.currentAimY = chooseBossAimY(bossData.currentTarget);
          setBossEyeState("neutral", true);
        }
        return;
      }

      if (bossPhase === BOSS_PHASES.AIM) {
        bossPhaseTimer -= 1;
        if (bossPhaseTimer > 16) {
          setBossEyeState("neutral");
        } else {
          setBossEyeState(bossData.currentTarget);
        }
        if (bossPhaseTimer <= 0) {
          let orbitIndex = bossData.orbitBalls.findIndex((orb) => orb.active);
          if (orbitIndex < 0) {
            bossData.orbitBalls = [];
            for (let i = 0; i < 6; i++) bossData.orbitBalls.push(createOrbitBall((Math.PI * 2 * i) / 6));
            orbitIndex = 0;
          }
          const source = bossData.orbitBalls[orbitIndex];
          source.active = false;
          const speed = 9.2 + heatRatio * 2.4;
          const towardLeft = bossData.currentTarget === "left";
          const targetX = towardLeft ? leftX + paddleW : rightX;
          // Each throw has an intentional, but non-perfect, random line. It is
          // still aimed at the selected side so a player can react to it.
          const targetY = clamp(
            chooseBossAimY(bossData.currentTarget) + (Math.random() - 0.5) * (90 + heatRatio * 70),
            42, canvas.height - 42
          );
          bossData.currentAimY = targetY;
          const aimAngle = Math.atan2(targetY - source.y, targetX - source.x);
          const randomThrowOffset = (Math.random() - 0.5) * (0.34 + heatRatio * 0.24);
          const angle = aimAngle + randomThrowOffset;
          bossData.projectile = {
            x: source.x,
            y: source.y,
            r: 11,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            target: bossData.currentTarget,
            targetY,
            jukeCooldown: 18 + Math.floor(Math.random() * 28),
            jukesRemaining: 1 + (Math.random() < 0.28 + heatRatio * 0.34 ? 1 : 0)
          };
          bossData.currentOrbitIndex = orbitIndex;
          bossPhase = BOSS_PHASES.THROW;
          bossPhaseTimer = 0;
          pongAudio.critical();
        }
        return;
      }

      if (bossPhase === BOSS_PHASES.THROW) {
        const projectile = bossData.projectile;
        if (!projectile) {
          bossPhase = BOSS_PHASES.AIM;
          bossPhaseTimer = 24;
          bossData.currentTarget = chooseBossTarget();
          return;
        }

        projectile.x += projectile.vx;
        projectile.y += projectile.vy;

        // Sentient-ball-style juke: a brief, readable mid-flight direction
        // change. It only alters the fireball's vertical path and never changes
        // hitboxes or paddle logic.
        if (projectile.jukesRemaining > 0) {
          projectile.jukeCooldown -= 1;
          const inJukeZone = projectile.x > canvas.width * 0.22 && projectile.x < canvas.width * 0.78;
          if (projectile.jukeCooldown <= 0 && inJukeZone) {
            const speed = Math.hypot(projectile.vx, projectile.vy);
            const horizontalSign = Math.sign(projectile.vx) || (projectile.target === "left" ? -1 : 1);
            const verticalAngle = Math.atan2(projectile.vy, projectile.vx) + (Math.random() < 0.5 ? -1 : 1) * (0.22 + Math.random() * 0.26);
            projectile.vx = Math.abs(Math.cos(verticalAngle) * speed) * horizontalSign;
            projectile.vy = Math.sin(verticalAngle) * speed;
            projectile.jukesRemaining -= 1;
            projectile.jukeCooldown = 9999;
            glitchPulse = Math.max(glitchPulse, 14);
            triggerCameraKick((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, 0.006);
            pongAudio.juke();
          }
        }

        if (projectile.y <= 10 || projectile.y >= canvas.height - 10) {
          projectile.vy *= -1;
          projectile.y = clamp(projectile.y, 10, canvas.height - 10);
          pongAudio.wallBounce();
          glitchPulse = Math.max(glitchPulse, 10);
        }

        const leftShieldPad = powerState.blue.shieldTimer > 0 ? 18 : 0;
        const rightShieldPad = powerState.red.shieldTimer > 0 ? 18 : 0;

        if (projectile.target === "left" &&
            projectile.x - projectile.r <= leftX + paddleW &&
            projectile.y >= leftY - leftShieldPad &&
            projectile.y <= leftY + paddleH + leftShieldPad &&
            projectile.vx < 0) {
          bossData.leftHits += 1;
          bossData.successfulReturns += 1;
          bossData.throwsResolved += 1;
          bossData.projectile = null;
          setBossEyeState("neutral", true);
          bossData.hitFlash = 12;
          glitchPulse = Math.max(glitchPulse, 20);
          triggerCameraKick(10, (Math.random() - 0.5) * 8, 0.016);
          impactFreezeFrames = Math.max(impactFreezeFrames, 1);
          pongAudio.paddleHit();
          pongAudio.glitch();
          if (bossData.currentOrbitIndex >= 0 && bossData.currentOrbitIndex < bossData.orbitBalls.length) {
            bossData.orbitBalls.splice(bossData.currentOrbitIndex, 1);
          }
          if (bossData.successfulReturns >= 6) {
            bossOutcome = { type: "success" };
            bossPhase = BOSS_PHASES.OUTRO;
            bossPhaseTimer = 46;
          } else {
            bossPhase = BOSS_PHASES.RESOLVE;
            bossPhaseTimer = 18;
          }
          return;
        }

        if (projectile.target === "right" &&
            projectile.x + projectile.r >= rightX &&
            projectile.y >= rightY - rightShieldPad &&
            projectile.y <= rightY + paddleH + rightShieldPad &&
            projectile.vx > 0) {
          bossData.rightHits += 1;
          bossData.successfulReturns += 1;
          bossData.throwsResolved += 1;
          bossData.projectile = null;
          setBossEyeState("neutral", true);
          bossData.hitFlash = 12;
          glitchPulse = Math.max(glitchPulse, 20);
          triggerCameraKick(-10, (Math.random() - 0.5) * 8, 0.016);
          impactFreezeFrames = Math.max(impactFreezeFrames, 1);
          pongAudio.paddleHit();
          pongAudio.glitch();
          if (bossData.currentOrbitIndex >= 0 && bossData.currentOrbitIndex < bossData.orbitBalls.length) {
            bossData.orbitBalls.splice(bossData.currentOrbitIndex, 1);
          }
          if (bossData.successfulReturns >= 6) {
            bossOutcome = { type: "success" };
            bossPhase = BOSS_PHASES.OUTRO;
            bossPhaseTimer = 46;
          } else {
            bossPhase = BOSS_PHASES.RESOLVE;
            bossPhaseTimer = 18;
          }
          return;
        }

        if (projectile.x < -projectile.r * 2) {
          bossData.throwsResolved += 1;
          bossOutcome = { type: "fail", failedSide: "left", awardSide: "right" };
          bossPhase = BOSS_PHASES.OUTRO;
          bossPhaseTimer = 46;
          pongAudio.score();
          pongAudio.glitch();
          return;
        }

        if (projectile.x > canvas.width + projectile.r * 2) {
          bossData.throwsResolved += 1;
          bossOutcome = { type: "fail", failedSide: "right", awardSide: "left" };
          bossPhase = BOSS_PHASES.OUTRO;
          bossPhaseTimer = 46;
          pongAudio.score();
          pongAudio.glitch();
          return;
        }

        return;
      }

      if (bossPhase === BOSS_PHASES.RESOLVE) {
        bossPhaseTimer -= 1;
        if (bossPhaseTimer <= 0) {
          bossData.currentTarget = chooseBossTarget();
          setBossEyeState("neutral", true);
          bossPhase = BOSS_PHASES.AIM;
          bossPhaseTimer = 34;
        }
        return;
      }

      if (bossPhase === BOSS_PHASES.OUTRO) {
        bossPhaseTimer -= 1;
        bossData.outroBallGrow = Math.min(1, bossData.outroBallGrow + 0.08);
        setBossEyeState("neutral", true);
        if (bossPhaseTimer <= 0) {
          finishBossFightWithScore();
        }
      }
    }

    function drawBossFight() {
      if (!bossModeActive || !bossData) return;

      const isBlinking = bossData.blinkFrames > 0;
      const useBlinkFrame = isBlinking && (
        bossData.eyeState === "left" ? bossEyeLeftBlinkReady
          : bossData.eyeState === "right" ? bossEyeRightBlinkReady
            : bossEyeNeutralBlinkReady
      );
      const eyeImage = bossData.eyeState === "left"
        ? (useBlinkFrame ? bossEyeLeftBlinkImage : bossEyeLeftReady ? bossEyeLeftImage : null)
        : bossData.eyeState === "right"
          ? (useBlinkFrame ? bossEyeRightBlinkImage : bossEyeRightReady ? bossEyeRightImage : null)
          : (useBlinkFrame ? bossEyeNeutralBlinkImage : bossEyeNeutralReady ? bossEyeNeutralImage : null);

      const alarmStrength = bossPhase === BOSS_PHASES.ALARM
        ? (0.18 + (Math.sin(bossData.alarmFlash) * 0.5 + 0.5) * 0.18)
        : 0.08;

      ctx.save();
      ctx.fillStyle = `rgba(255,24,44,${alarmStrength})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 5; i++) {
        const y = 50 + ((performance.now() * 0.05 + i * 61) % Math.max(60, canvas.height - 100));
        ctx.fillStyle = `rgba(255,90,110,${0.05 + alarmStrength * 0.18})`;
        ctx.fillRect(0, y, canvas.width, 2);
      }

      if (bossPhase === BOSS_PHASES.ALARM || bossPhase === BOSS_PHASES.CENTER_GLITCH) {
        ctx.fillStyle = "rgba(255,180,180,0.92)";
        ctx.font = "bold 28px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const warning = bossPhase === BOSS_PHASES.ALARM ? "SYSTEM CORRUPTED" : "CORRUPTION BREACH";
        ctx.fillText(warning, canvas.width / 2, canvas.height * 0.18);
        ctx.font = "bold 14px monospace";
        ctx.fillStyle = "rgba(255,240,240,0.82)";
        ctx.fillText("MAX HEAT // CORE ENTITY DETECTED", canvas.width / 2, canvas.height * 0.18 + 32);
      }

      const orbitGlow = bossData.hitFlash > 0 ? 0.78 : 0.48;
      for (const orb of bossData.orbitBalls) {
        if (!orb.active) continue;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.70 + orbitGlow * 0.18})`;
        ctx.shadowColor = "rgba(255,64,64,0.85)";
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (bossPhase === BOSS_PHASES.CENTER_GLITCH) {
        ctx.beginPath();
        ctx.arc(ballX, ballY, BALL_R + 1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.shadowColor = "rgba(255,48,48,0.8)";
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      const eyeScale = bossPhase === BOSS_PHASES.MATERIALIZE
        ? 0.62 + (1 - bossPhaseTimer / 26) * 0.58
        : bossPhase === BOSS_PHASES.OUTRO && bossOutcome && bossOutcome.type === "fail"
          ? 1.2 - Math.min(0.82, bossData.outroBallGrow * 0.82)
          : 1.2;

      if (eyeImage && bossPhase !== BOSS_PHASES.ALARM) {
        const baseW = 180 * eyeScale;
        const baseH = 104 * eyeScale;
        const hitJitter = bossData.hitFlash > 0 ? (Math.random() - 0.5) * 8 : 0;
        const glitchJitterX = bossData.eyeGlitchFrames > 0 ? (Math.random() - 0.5) * 12 : 0;
        const glitchJitterY = bossData.eyeGlitchFrames > 0 ? (Math.random() - 0.5) * 6 : 0;
        const drawX = bossData.centerX - baseW / 2 + hitJitter + glitchJitterX;
        const drawY = bossData.centerY - baseH / 2 + glitchJitterY;
        // The blink source art has a much wider internal canvas than the open-eye
        // frames. Crop and map its visible bounds into the open frame's bounds so
        // the boss neither grows nor shifts while blinking.
        const normalBounds = {
          left:    [96, 190, 290, 120],
          right:   [106, 186, 302, 122],
          neutral: [104, 186, 282, 132]
        }[bossData.eyeState];
        const blinkBounds = {
          left:    [12, 146, 480, 208],
          right:   [4, 146, 494, 208],
          neutral: [12, 132, 470, 230]
        }[bossData.eyeState];
        const drawEyeFrame = (x, y) => {
          if (!useBlinkFrame) {
            ctx.drawImage(eyeImage, x, y, baseW, baseH);
            return;
          }
          const [sx, sy, sw, sh] = blinkBounds;
          const [nx, ny, nw, nh] = normalBounds;
          ctx.drawImage(
            eyeImage, sx, sy, sw, sh,
            x + (nx / 500) * baseW,
            y + (ny / 500) * baseH,
            (nw / 500) * baseW,
            (nh / 500) * baseH
          );
        };
        if (bossData.eyeGlitchFrames > 0) {
          ctx.globalAlpha = 0.34;
          drawEyeFrame(drawX - 10, drawY + 2);
          drawEyeFrame(drawX + 8, drawY - 3);
          ctx.globalAlpha = 1;
        }
        drawEyeFrame(drawX, drawY);
      } else if (bossPhase !== BOSS_PHASES.ALARM) {
        ctx.beginPath();
        ctx.ellipse(bossData.centerX, bossData.centerY, 82 * eyeScale, 40 * eyeScale, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();
      }

      if (bossData.projectile) {
        const traceBoost = GlitchProgression.hasPerk("bosstrace") ? 1 : 0;
        ctx.beginPath();
        ctx.arc(bossData.projectile.x, bossData.projectile.y, bossData.projectile.r * (1 + traceBoost * 0.3), 0, Math.PI * 2);
        ctx.fillStyle = traceBoost ? "rgba(255,220,80,0.98)" : "rgba(255,255,255,0.96)";
        ctx.shadowColor = traceBoost ? "rgba(255,200,0,0.95)" : "rgba(255,64,64,0.86)";
        ctx.shadowBlur = 18 + traceBoost * 20;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`BOSS RETURNS // BLUE ${bossData.leftHits}/3 // RED ${bossData.rightHits}/3`, canvas.width / 2, canvas.height - 30);
      ctx.restore();
    }

    function drawPaddle(x, y, img, isReady, glowColor, fillColor) {
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 30 + Math.max(0, glitchPulse * 0.35);

      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, paddleW, paddleH);

      if (isReady) {
        // Preserve the paddle texture while tinting it to the selected cosmetic.
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, paddleW, paddleH);
        ctx.clip();
        ctx.globalAlpha = 0.24;
        ctx.drawImage(img, x, y, paddleW, paddleH);
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.56;
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, paddleW, paddleH);
        ctx.restore();
      }

      ctx.strokeStyle = glowColor;
      ctx.globalAlpha = 0.82;
      ctx.lineWidth = 1.75;
      ctx.strokeRect(x + 0.5, y + 0.5, paddleW - 1, paddleH - 1);
      ctx.restore();
    }

    // The regular arenas use a moving/zooming camera. Keep their paddles in
    // screen space, as Matrix already does, so neither can slip beyond an edge.
    function drawScreenSpacePaddles() {
      const heatRatio = getHeatRatio();
      ctx.save();

      for (const trail of leftDashTrail) {
        const alpha = Math.max(0, trail.life / 16) * (0.18 + heatRatio * 0.14);
        ctx.fillStyle = `rgba(103,239,255,${alpha})`;
        ctx.shadowColor = `rgba(103,239,255,${alpha * 1.4})`;
        ctx.shadowBlur = 16;
        ctx.fillRect(trail.x, trail.y, paddleW, paddleH);
        ctx.shadowBlur = 0;
      }
      for (const trail of rightDashTrail) {
        const alpha = Math.max(0, trail.life / 16) * (0.18 + heatRatio * 0.14);
        ctx.fillStyle = `rgba(255,79,216,${alpha})`;
        ctx.shadowColor = `rgba(255,79,216,${alpha * 1.4})`;
        ctx.shadowBlur = 16;
        ctx.fillRect(trail.x, trail.y, paddleW, paddleH);
        ctx.shadowBlur = 0;
      }

      if (powerState.blue.shieldTimer > 0) {
        ctx.fillStyle = "rgba(103,239,255,0.10)";
        ctx.fillRect(0, 0, leftX + paddleW + 4, canvas.height);
        ctx.fillStyle = "rgba(103,239,255,0.22)";
        ctx.fillRect(leftX + paddleW, 0, 4, canvas.height);
      }
      if (powerState.red.shieldTimer > 0) {
        ctx.fillStyle = "rgba(255,79,216,0.10)";
        ctx.fillRect(rightX - 4, 0, canvas.width - rightX + 4, canvas.height);
        ctx.fillStyle = "rgba(255,79,216,0.22)";
        ctx.fillRect(rightX - 4, 0, 4, canvas.height);
      }

      drawPaddle(leftX, leftY, bluePaddleImage, leftImageReady, ownerColor("blue"), ownerHex("blue"));
      drawPaddle(rightX, rightY, redPaddleImage, rightImageReady, ownerColor("red"), ownerHex("red"));

      if (heatRatio > 0.15) {
        ctx.strokeStyle = `rgba(255,79,216,${0.18 + heatRatio * 0.22})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(leftX - 2, leftY - 2, paddleW + 4, paddleH + 4);
        ctx.strokeRect(rightX - 2, rightY - 2, paddleW + 4, paddleH + 4);
      }
      ctx.restore();
    }

    function drawGlitchOverlay() {
      if (glitchPulse <= 0) return;

      const alpha = Math.min(0.18, glitchPulse / 120);
      for (let i = 0; i < 4; i++) {
        const gy = 40 + ((glitchPulse * 17 + i * 73) % Math.max(60, canvas.height - 80));
        ctx.fillStyle = `rgba(103,239,255,${alpha})`;
        ctx.fillRect(0, gy, canvas.width, 3);
        ctx.fillStyle = `rgba(255,79,216,${alpha * 0.9})`;
        ctx.fillRect(0, gy + 4, canvas.width, 2);
      }

      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.45})`;
      for (let y = 0; y < canvas.height; y += 5) {
        ctx.fillRect(0, y, canvas.width, 1);
      }
    }

    function applyBallInstability() {
      if (vx === 0 && vy === 0) return;
      const speed = Math.hypot(vx, vy);
      const angle = Math.atan2(vy, vx);
      const heatRatio = getHeatRatio();
      const angleShift = (Math.random() - 0.5) * (Math.PI / 90) * (1 + heatRatio * 0.65);
      const speedFactorAdjust = 1 + ((Math.random() - 0.5) * 0.04 * (1 + heatRatio * 0.4));
      const newSpeed = speed * speedFactorAdjust;
      vx = Math.cos(angle + angleShift) * newSpeed;
      vy = Math.sin(angle + angleShift) * newSpeed;
    }

    function updateBlackHoleNexusGameplay(heatRatio) {
      if (currentArenaId !== "blackhole" || bossModeActive || preBossActive || roundFrozen) return;
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      const dx = cx - ballX;
      const dy = cy - ballY;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const gravityZone = Math.min(W, H) * (0.27 + heatRatio * 0.055);

      // Subtle curve only inside the Nexus gravity zone. It nudges trajectory;
      // it does not overwrite core Pong movement or paddle reads.
      if (dist < gravityZone && Math.abs(vx) + Math.abs(vy) > 0.1) {
        const pull = Math.pow(1 - dist / gravityZone, 1.35) * (0.012 + heatRatio * 0.020);
        vx += (dx / dist) * pull;
        vy += (dy / dist) * pull;
      }

      blackHoleState.anomalies = blackHoleState.anomalies
        .map(a => ({ ...a, life: a.life - 1, spin: a.spin + 0.01 * a.dir }))
        .filter(a => a.life > 0);
      blackHoleState.microHoles = blackHoleState.microHoles
        .map(h => ({ ...h, life: h.life - 1 }))
        .filter(h => h.life > 0);

      if (heatRatio >= 0.2) {
        blackHoleState.anomalyCooldown--;
        if (blackHoleState.anomalyCooldown <= 0) {
          const marginX = W * 0.22;
          const marginY = 80;
          blackHoleState.anomalies.push({
            x: marginX + Math.random() * (W - marginX * 2),
            y: marginY + Math.random() * (H - marginY * 2),
            r: 22 + Math.random() * (18 + heatRatio * 18),
            kind: Math.random() < 0.52 ? "boost" : "drag",
            life: 170 + Math.floor(Math.random() * 90),
            maxLife: 250,
            spin: Math.random() * Math.PI * 2,
            dir: Math.random() < 0.5 ? -1 : 1,
            used: false
          });
          if (blackHoleState.anomalies.length > 3) blackHoleState.anomalies.shift();
          blackHoleState.anomalyCooldown = Math.max(95, 230 - Math.floor(heatRatio * 70)) + Math.floor(Math.random() * 150);
        }
      }

      for (const anomaly of blackHoleState.anomalies) {
        if (anomaly.used) continue;
        const ad = Math.hypot(ballX - anomaly.x, ballY - anomaly.y);
        if (ad <= anomaly.r + BALL_R) {
          const factor = anomaly.kind === "boost" ? (1.12 + heatRatio * 0.10) : Math.max(0.90, 0.96 - heatRatio * 0.04);
          vx *= factor;
          vy *= factor;
          anomaly.used = true;
          anomaly.life = Math.min(anomaly.life, 28);
          glitchPulse = Math.max(glitchPulse, 10 + Math.floor(heatRatio * 12));
          triggerCameraKick((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, 0.01);
          pongAudio.juke();
        }
      }

      if (heatRatio >= 0.8) {
        blackHoleState.microCooldown--;
        if (blackHoleState.microCooldown <= 0) {
          blackHoleState.microHoles.push({
            x: W * 0.26 + Math.random() * W * 0.48,
            y: H * 0.16 + Math.random() * H * 0.68,
            r: 14 + Math.random() * 10,
            life: 95 + Math.floor(Math.random() * 60),
            maxLife: 150,
            spin: Math.random() * Math.PI * 2,
            triggered: false
          });
          if (blackHoleState.microHoles.length > 2) blackHoleState.microHoles.shift();
          blackHoleState.microCooldown = 210 + Math.floor(Math.random() * 210);
        }
      }

      for (const hole of blackHoleState.microHoles) {
        if (hole.triggered) continue;
        if (Math.hypot(ballX - hole.x, ballY - hole.y) <= hole.r + BALL_R) {
          const speed = clamp(Math.hypot(vx, vy) * (0.92 + Math.random() * 0.28), 6.2, 14.5);
          let angle = Math.atan2(vy, vx) + (Math.random() - 0.5) * Math.PI * 0.92;
          if (Math.abs(Math.cos(angle)) < 0.28) angle += Math.sign(Math.cos(angle) || 1) * 0.35;
          ballX = hole.x + Math.cos(angle) * (hole.r + BALL_R + 8);
          ballY = clamp(hole.y + Math.sin(angle) * (hole.r + BALL_R + 8), BALL_R + 4, H - BALL_R - 4);
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          hole.triggered = true;
          hole.life = Math.min(hole.life, 20);
          ballTrail = [];
          glitchPulse = Math.max(glitchPulse, 22);
          triggerCameraKick((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 12, 0.02);
          pongAudio.teleport();
        }
      }
    }

    function triggerCameraKick(strengthX = 0, strengthY = 0, zoomBoost = 0) {
      cameraKickX += strengthX;
      cameraKickY += strengthY;
      cameraTargetZoom = Math.max(cameraTargetZoom, 1 + zoomBoost);
    }

    function getComboRatio() {
      return Math.max(0, Math.min(1, combo / 12));
    }

    function updateClutchMode() {
      const shouldClutch = Math.abs(leftScore - rightScore) <= 1 && (leftScore >= 8 || rightScore >= 8);
      if (shouldClutch && !clutchMode) {
        clutchMode = true;
        glitchPulse = Math.max(glitchPulse, 18);
        triggerCameraKick((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, 0.02);
        pongAudio.critical();
      } else if (!shouldClutch) {
        clutchMode = false;
      }
    }

    function drawSystemBackdrop(alpha = 0.18) {
      const heatRatio = getHeatRatio();
      const t = performance.now() * 0.0012;

      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, `rgba(4,10,20,${0.98 * alpha + 0.02})`);
      bg.addColorStop(0.48, `rgba(2,8,18,${0.94 * alpha + 0.02})`);
      bg.addColorStop(1, `rgba(1,4,10,${alpha + 0.04})`);
      ctx.fillStyle = bg;
      ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

      const leftGlow = ctx.createRadialGradient(canvas.width * 0.14, canvas.height * 0.5, 20, canvas.width * 0.14, canvas.height * 0.5, canvas.width * 0.44);
      leftGlow.addColorStop(0, `rgba(103,239,255,${0.10 + heatRatio * 0.05})`);
      leftGlow.addColorStop(1, 'rgba(103,239,255,0)');
      ctx.fillStyle = leftGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const rightGlow = ctx.createRadialGradient(canvas.width * 0.86, canvas.height * 0.5, 20, canvas.width * 0.86, canvas.height * 0.5, canvas.width * 0.44);
      rightGlow.addColorStop(0, `rgba(255,79,216,${0.08 + heatRatio * 0.04})`);
      rightGlow.addColorStop(1, 'rgba(255,79,216,0)');
      ctx.fillStyle = rightGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const topFade = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.18);
      topFade.addColorStop(0, 'rgba(14,32,44,0.18)');
      topFade.addColorStop(1, 'rgba(14,32,44,0)');
      ctx.fillStyle = topFade;
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.18);

      const bottomFade = ctx.createLinearGradient(0, canvas.height, 0, canvas.height * 0.8);
      bottomFade.addColorStop(0, 'rgba(8,18,28,0.22)');
      bottomFade.addColorStop(1, 'rgba(8,18,28,0)');
      ctx.fillStyle = bottomFade;
      ctx.fillRect(0, canvas.height * 0.8, canvas.width, canvas.height * 0.2);

      const laneXs = [canvas.width * 0.1, canvas.width * 0.18, canvas.width * 0.82, canvas.width * 0.9];
      laneXs.forEach((x, i) => {
        ctx.fillStyle = i < 2 ? 'rgba(103,239,255,0.05)' : 'rgba(255,79,216,0.05)';
        ctx.fillRect(x, 0, 2, canvas.height);
        ctx.fillStyle = i < 2 ? 'rgba(103,239,255,0.09)' : 'rgba(255,79,216,0.09)';
        for (let y = ((t * 120) + i * 80) % (canvas.height + 120) - 120; y < canvas.height + 120; y += 140) {
          ctx.fillRect(x - 4, y, 10, 26);
        }
      });


      const packetStreams = [
        { x1: canvas.width * 0.18, y1: canvas.height * 0.18, x2: canvas.width * 0.46, y2: canvas.height * 0.32, color: '103,239,255', phase: 0 },
        { x1: canvas.width * 0.14, y1: canvas.height * 0.78, x2: canvas.width * 0.42, y2: canvas.height * 0.62, color: '103,239,255', phase: 0.35 },
        { x1: canvas.width * 0.82, y1: canvas.height * 0.22, x2: canvas.width * 0.54, y2: canvas.height * 0.36, color: '255,79,216', phase: 0.2 },
        { x1: canvas.width * 0.86, y1: canvas.height * 0.74, x2: canvas.width * 0.58, y2: canvas.height * 0.58, color: '255,79,216', phase: 0.55 }
      ];

      packetStreams.forEach((stream) => {
        ctx.strokeStyle = `rgba(${stream.color},0.11)`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(stream.x1, stream.y1);
        ctx.lineTo(stream.x2, stream.y2);
        ctx.stroke();

        for (let i = 0; i < 4; i++) {
          const progress = ((t * 0.42) + stream.phase + i * 0.26) % 1;
          const px = stream.x1 + (stream.x2 - stream.x1) * progress;
          const py = stream.y1 + (stream.y2 - stream.y1) * progress;
          const packetW = 18;
          const packetH = 4;
          const angle = Math.atan2(stream.y2 - stream.y1, stream.x2 - stream.x1);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(angle);
          ctx.shadowColor = `rgba(${stream.color},0.45)`;
          ctx.shadowBlur = 12;
          ctx.fillStyle = `rgba(${stream.color},0.72)`;
          ctx.fillRect(-packetW / 2, -packetH / 2, packetW, packetH);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillRect(packetW / 2 - 5, -packetH / 2, 5, packetH);
          ctx.restore();
        }
      });

      for (let lane = 0; lane < 10; lane++) {
        const x = ((lane + 1) / 11) * canvas.width;
        const travel = ((t * (90 + lane * 7)) + lane * 57) % (canvas.height + 120) - 60;
        const color = lane < 5 ? '103,239,255' : '255,79,216';
        ctx.fillStyle = `rgba(${color},0.12)`;
        ctx.fillRect(x - 1, 0, 2, canvas.height);
        ctx.fillStyle = `rgba(${color},0.58)`;
        ctx.shadowColor = `rgba(${color},0.4)`;
        ctx.shadowBlur = 12;
        ctx.fillRect(x - 4, travel, 8, 28);
        ctx.shadowBlur = 0;
      }

      ctx.strokeStyle = 'rgba(120,210,220,0.07)';
      ctx.lineWidth = 1;
      for (let y = 54; y < canvas.height - 54; y += 64) {
        ctx.beginPath();
        ctx.moveTo(34, y);
        ctx.lineTo(74, y);
        ctx.lineTo(96, y + 14);
        ctx.lineTo(canvas.width * 0.22, y + 14);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(canvas.width - 34, y);
        ctx.lineTo(canvas.width - 74, y);
        ctx.lineTo(canvas.width - 96, y + 14);
        ctx.lineTo(canvas.width * 0.78, y + 14);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.018)';
      for (let y = 0; y < canvas.height; y += 6) {
        ctx.fillRect(0, y, canvas.width, 1);
      }

      ctx.strokeStyle = 'rgba(103,239,255,0.12)';
      ctx.lineWidth = 1;
      const m = 26;
      const c = 34;
      ctx.beginPath();
      ctx.moveTo(m, c + m); ctx.lineTo(m, m); ctx.lineTo(c + m, m);
      ctx.moveTo(canvas.width - m - c, m); ctx.lineTo(canvas.width - m, m); ctx.lineTo(canvas.width - m, c + m);
      ctx.moveTo(m, canvas.height - m - c); ctx.lineTo(m, canvas.height - m); ctx.lineTo(c + m, canvas.height - m);
      ctx.moveTo(canvas.width - m - c, canvas.height - m); ctx.lineTo(canvas.width - m, canvas.height - m); ctx.lineTo(canvas.width - m, canvas.height - m - c);
      ctx.stroke();

      const vignette = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.18, canvas.width / 2, canvas.height / 2, canvas.width * 0.68);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.34)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawArenaBase(alpha = 0.18, showPaddles = true) {
      ctx.save();

      const heatRatio = getHeatRatio();
      let jitterX = 0;
      let jitterY = 0;
      if (shakeFrames > 0) {
        jitterX = (Math.random() * 16) - 8;
        jitterY = (Math.random() * 10) - 5;
      } else if (glitchPulse > 0) {
        jitterX = (Math.random() * (4 + heatRatio * 2)) - (2 + heatRatio);
      }
      arenaJitter = jitterX;

      const ballPanX = ((ballX / Math.max(1, canvas.width)) - 0.5) * (8 + heatRatio * 12);
      const ballPanY = ((ballY / Math.max(1, canvas.height)) - 0.5) * (5 + heatRatio * 8);
      cameraDriftX += (ballPanX - cameraDriftX) * 0.08;
      cameraDriftY += (ballPanY - cameraDriftY) * 0.08;
      cameraKickX *= 0.82;
      cameraKickY *= 0.82;
      cameraTargetZoom = 1 + heatRatio * 0.035 + Math.min(0.018, rallyHits * 0.0015);
      cameraZoom += (cameraTargetZoom - cameraZoom) * 0.12;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(cameraZoom, cameraZoom);
      ctx.translate(
        -canvas.width / 2 + jitterX + cameraDriftX + cameraKickX,
        -canvas.height / 2 + jitterY + cameraDriftY + cameraKickY
      );

      ctx.clearRect(-60, -60, canvas.width + 120, canvas.height + 120);
      if (currentArenaId === "construct") {
        drawConstructBackdrop(heatRatio);
      } else if (currentArenaId === "blackhole") {
        drawBlackHoleBackdrop(heatRatio);
      } else {
        drawSystemBackdrop(alpha);
      }

      if (currentArenaId === "construct") {
        drawConstructCenterConduit(heatRatio);
      } else if (currentArenaId === "blackhole") {
        ctx.strokeStyle = `rgba(177,0,211,${0.18 + heatRatio * 0.16})`;
        ctx.setLineDash([10, 14]);
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = "rgba(86,224,255,0.18)";
        ctx.setLineDash([12, 12]);
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (showPaddles) {
        for (const trail of leftDashTrail) {
          const dashAlpha = Math.max(0, trail.life / 16) * (0.18 + heatRatio * 0.14);
          ctx.fillStyle = `rgba(103,239,255,${dashAlpha})`;
          ctx.shadowColor = `rgba(103,239,255,${dashAlpha * 1.4})`;
          ctx.shadowBlur = 16;
          ctx.fillRect(trail.x, trail.y, paddleW, paddleH);
          ctx.shadowBlur = 0;
        }

        for (const trail of rightDashTrail) {
          const dashAlpha = Math.max(0, trail.life / 16) * (0.18 + heatRatio * 0.14);
          ctx.fillStyle = `rgba(255,79,216,${dashAlpha})`;
          ctx.shadowColor = `rgba(255,79,216,${dashAlpha * 1.4})`;
          ctx.shadowBlur = 16;
          ctx.fillRect(trail.x, trail.y, paddleW, paddleH);
          ctx.shadowBlur = 0;
        }

        if (powerState.blue.shieldTimer > 0) {
          // Full wall shield — covers entire left side
          const shieldAlpha = 0.22;
          const glowAlpha = 0.10;
          ctx.fillStyle = `rgba(103,239,255,${glowAlpha})`;
          ctx.fillRect(0, 0, leftX + paddleW + 4, canvas.height);
          ctx.fillStyle = `rgba(103,239,255,${shieldAlpha})`;
          ctx.fillRect(leftX + paddleW, 0, 4, canvas.height);
          ctx.shadowColor = "rgba(103,239,255,0.8)";
          ctx.shadowBlur = 18;
          ctx.fillRect(leftX + paddleW, 0, 4, canvas.height);
          ctx.shadowBlur = 0;
        }
        if (powerState.red.shieldTimer > 0) {
          // Full wall shield — covers entire right side
          const shieldAlpha = 0.22;
          const glowAlpha = 0.10;
          ctx.fillStyle = `rgba(255,79,216,${glowAlpha})`;
          ctx.fillRect(rightX - 4, 0, canvas.width - rightX + 4, canvas.height);
          ctx.fillStyle = `rgba(255,79,216,${shieldAlpha})`;
          ctx.fillRect(rightX - 4, 0, 4, canvas.height);
          ctx.shadowColor = "rgba(255,79,216,0.8)";
          ctx.shadowBlur = 18;
          ctx.fillRect(rightX - 4, 0, 4, canvas.height);
          ctx.shadowBlur = 0;
        }

        // Paddles are rendered after the camera pass in screen space.

        updateClutchMode();

      if (comboTimer > 0) {
        comboTimer -= 1;
      } else if (combo !== 0) {
        combo = 0;
      }

      if (leftDashCooldown > 0) {
          ctx.fillStyle = `rgba(103,239,255,${0.16 + dashCooldownRatio(leftDashCooldown) * 0.16})`;
          ctx.fillRect(leftX - 6, leftY, 3, paddleH * (leftDashCooldown / DASH_COOLDOWN_MAX));
        }
        if (twoPlayerMode && rightDashCooldown > 0) {
          ctx.fillStyle = `rgba(255,79,216,${0.16 + dashCooldownRatio(rightDashCooldown) * 0.16})`;
          ctx.fillRect(rightX + paddleW + 3, rightY, 3, paddleH * (rightDashCooldown / DASH_COOLDOWN_MAX));
        }

        if (!bossModeActive) {
        // Trail — longer and more saturated at higher charge
        const trailScale = Math.min(3, 1 + (colorCharge - 1) * 0.45);
        for (let i = ballTrail.length - 1; i >= 0; i--) {
          const t = ballTrail[i];
          const progress = (ballTrail.length - i) / (ballTrail.length + 1);
          const size = (BALL_R + heatRatio * 0.8) * (1 - progress * 0.25);
          const baseOpacity = (0.05 + progress * 0.15) * (1 + heatRatio * 0.35) * trailScale;
          ctx.beginPath();
          ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
          if (colorCharge >= 2 && ballOwner !== "neutral") {
            const col = ownerRgb(ballOwner);
            ctx.fillStyle   = `rgba(${col},${Math.min(0.9, baseOpacity * 1.4)})`;
            ctx.shadowColor = `rgba(${col},0.4)`;
          } else {
            ctx.fillStyle   = `rgba(255,255,255,${baseOpacity})`;
            ctx.shadowColor = `rgba(255,255,255,${0.3 * (1 - progress)})`;
          }
          ctx.shadowBlur = (14 + heatRatio * 6) * (1 - progress);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        for (let i = 0; i < decoys.length; i++) {
          const decoy = decoys[i];
          const lifeRatio = Math.max(0, decoy.life / decoy.maxLife);
          ctx.beginPath();
          ctx.arc(decoy.x, decoy.y, (8 + heatRatio * 0.6) * (0.92 + lifeRatio * 0.18), 0, Math.PI * 2);
          ctx.fillStyle = ownerHex(ballOwner);
          ctx.shadowColor = ownerColor(ballOwner, 0.75 + heatRatio * 0.2);
          ctx.shadowBlur = 22 + heatRatio * 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        if (arenaPowerup) {
          const pulse = 1 + Math.sin(arenaPowerup.pulse) * 0.12;
          const r = arenaPowerup.r * pulse;
          const typeColor = arenaPowerup.type === "shield" ? "rgba(103,239,255,0.95)" : arenaPowerup.type === "power" ? "rgba(255,209,102,0.95)" : "rgba(255,79,216,0.95)";
          ctx.beginPath();
          ctx.arc(arenaPowerup.x, arenaPowerup.y, r + 6, 0, Math.PI * 2);
          ctx.fillStyle = typeColor.replace('0.95', '0.10');
          ctx.fill();
          ctx.beginPath();
          ctx.arc(arenaPowerup.x, arenaPowerup.y, r, 0, Math.PI * 2);
          ctx.fillStyle = typeColor.replace('0.95', '0.20');
          ctx.shadowColor = typeColor;
          ctx.shadowBlur = 18;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = typeColor;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.font = "bold 14px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(arenaPowerup.type === "shield" ? "S" : arenaPowerup.type === "power" ? "P" : "X", arenaPowerup.x, arenaPowerup.y + 1);
        }

        // ── Ball — glow + size scale with colorCharge ──────────────────
        const chargeGlow  = (colorCharge - 1) * 9;
        const chargeSize  = (colorCharge - 1) * 0.5;
        drawColorChargeFX(ballX, ballY);   // extra effects below/around ball
        ctx.beginPath();
        ctx.arc(ballX, ballY, BALL_R + heatRatio * 1.2 + chargeSize, 0, Math.PI * 2);
        ctx.fillStyle   = ownerHex(ballOwner);
        ctx.shadowColor = ownerColor(ballOwner, 0.75 + heatRatio * 0.2 + (colorCharge - 1) * 0.05);
        ctx.shadowBlur  = 22 + heatRatio * 12 + chargeGlow;
        ctx.fill();
        ctx.shadowBlur  = 0;

        // Drowsy Z particles — float up from the ball during exhaustion
        drawDrowsyFX(heatRatio);
        }

        if (heatRatio > 0.15 && currentArenaId === "matrix") {
          ctx.strokeStyle = `rgba(255,79,216,${0.18 + heatRatio * 0.22})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(leftX - 2, leftY - 2, paddleW + 4, paddleH + 4);
          ctx.strokeRect(rightX - 2, rightY - 2, paddleW + 4, paddleH + 4);
        }
      }

      if (scoreFlashFrames > 0) {
        const flashAlpha = scoreFlashFrames / 28;
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha * 0.20})`;
        ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);
        ctx.fillStyle = `rgba(255,79,216,${flashAlpha * 0.10})`;
        ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);
      }


      if (breachFlashFrames > 0) {
        const breachRatio = breachFlashFrames / 52;
        const sideX = breachSide < 0 ? 0 : canvas.width;
        const breachColor = breachSide < 0 ? '103,239,255' : '255,79,216';

        const wave = ctx.createRadialGradient(sideX, canvas.height / 2, 20, sideX, canvas.height / 2, canvas.width * 0.85);
        wave.addColorStop(0, `rgba(${breachColor},${0.26 * breachRatio})`);
        wave.addColorStop(0.25, `rgba(${breachColor},${0.12 * breachRatio})`);
        wave.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = wave;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < 7; i++) {
          const lineY = (canvas.height * 0.12) + (((52 - breachFlashFrames) * 17) + i * 58) % (canvas.height * 0.76);
          ctx.fillStyle = `rgba(${breachColor},${0.22 * breachRatio})`;
          ctx.fillRect(0, lineY, canvas.width, 2);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(0, lineY + 3, canvas.width, 1);
        }

        ctx.save();
        ctx.strokeStyle = `rgba(${breachColor},${0.34 * breachRatio})`;
        ctx.lineWidth = 4;
        const edgeX = breachSide < 0 ? 10 : canvas.width - 10;
        ctx.beginPath();
        ctx.moveTo(edgeX, 14);
        ctx.lineTo(edgeX, canvas.height - 14);
        ctx.stroke();
        ctx.restore();
      }

      drawGlitchOverlay();

      if (combo > 2) {
        const comboRatio = getComboRatio();
        ctx.fillStyle = `rgba(255,79,216,${0.04 + comboRatio * 0.08})`;
        ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);
      }

      if (clutchMode) {
        ctx.strokeStyle = `rgba(255,70,110,${0.16 + heatRatio * 0.16})`;
        ctx.lineWidth = 6;
        ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
      }

      ctx.restore();
    }


    function updateColorCharge(side) {
      if (lastHitSide === side) {
        colorCharge = Math.min(colorCharge + 1, MAX_COLOR_CHARGE);
      } else {
        colorCharge = 1;
      }
      lastHitSide = side;
      chargeFlashT = 10 + colorCharge * 2;
    }

    // Extra effects layered ON TOP of the base ball draw — scaled by colorCharge
    function drawColorChargeFX(bx, by) {
      if (colorCharge < 2 || bossModeActive) return;
      const t   = Date.now();
      const c   = colorCharge;
        const col = ownerRgb(ballOwner).split(",").map(Number);
      const [r, g, b] = col;
      ctx.save();

      // ── Charge 2: soft outer glow ring ────────────────────────────────
      if (c >= 2) {
        const pulse = 0.7 + Math.sin(t * 0.008) * 0.3;
        ctx.beginPath();
        ctx.arc(bx, by, BALL_R + 6 + c * 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.25 * pulse * (c - 1) * 0.5})`;
        ctx.lineWidth   = 2 + c;
        ctx.shadowColor = `rgba(${r},${g},${b},0.6)`;
        ctx.shadowBlur  = 10 + c * 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── Charge 3: animated pixel-particle orbit ring ───────────────────
      if (c >= 3) {
        const numDots = 6 + c * 2;
        const orbitR  = BALL_R + 10 + c * 3;
        for (let i = 0; i < numDots; i++) {
          const angle = (t * 0.003 + i * (Math.PI * 2 / numDots));
          const dx = bx + Math.cos(angle) * orbitR;
          const dy = by + Math.sin(angle) * orbitR;
          const sz = 2 + (c - 2) * 1.5;
          ctx.globalAlpha = 0.6 + Math.sin(t * 0.01 + i) * 0.3;
          ctx.fillStyle   = `rgb(${r},${g},${b})`;
          ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
          ctx.shadowBlur  = 6;
          ctx.fillRect(dx - sz / 2, dy - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
      }

      // ── Charge 4+: RGB split + pulsing corruption ring + pixel noise ───
      if (c >= 4) {
        const splitOff = 2 + (c - 3) * 2;
        const r2 = BALL_R + getHeatRatio() * 1.2;

        // RGB channel split ghosts
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(bx - splitOff, by, r2, 0, Math.PI * 2);
        ctx.fillStyle = "#ff0040"; ctx.fill();
        ctx.beginPath(); ctx.arc(bx + splitOff, by, r2, 0, Math.PI * 2);
        ctx.fillStyle = "#00ffff"; ctx.fill();
        ctx.globalAlpha = 1;

        // Corrupted pixel noise burst
        const noiseCount = 4 + (c - 3) * 3;
        for (let i = 0; i < noiseCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist  = BALL_R + 2 + Math.random() * 18;
          const nx = bx + Math.cos(angle) * dist;
          const ny = by + Math.sin(angle) * dist;
          const nw = 2 + Math.floor(Math.random() * 4);
          ctx.fillStyle = Math.random() > 0.5
            ? `rgb(${r},${g},${b})`
            : `rgba(255,255,255,0.8)`;
          ctx.fillRect(nx, ny, nw, nw);
        }

        // Pulsing double-outline
        const pulseA = 0.4 + Math.sin(t * 0.02) * 0.3;
        const pulseB = 0.4 + Math.sin(t * 0.02 + Math.PI) * 0.3;
        ctx.strokeStyle = `rgba(${r},${g},${b},${pulseA})`;
        ctx.lineWidth   = 2;
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
        ctx.shadowBlur  = 18;
        ctx.beginPath(); ctx.arc(bx, by, r2 + 9 + (c - 3) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${pulseB * 0.5})`;
        ctx.beginPath(); ctx.arc(bx, by, r2 + 14 + (c - 3) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Screen-space corner distortion flash at max charge
        if (c >= 5) {
          const distA = 0.04 * (c - 4) * Math.abs(Math.sin(t * 0.025));
          ctx.fillStyle = `rgba(${r},${g},${b},${distA})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }

      // Charge-up flash
      if (chargeFlashT > 0) {
        chargeFlashT--;
        const fa = chargeFlashT / (10 + colorCharge * 2) * 0.3;
        ctx.fillStyle = `rgba(${r},${g},${b},${fa})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.restore();
    }

    function drawCriticalHeatWarning() {
      if (criticalHeatTimer > 0) {
        const p     = criticalHeatTimer / 160;
        const alpha = Math.min(1, p * 4) * Math.min(1, (1 - p) * 4 + 0.1);
        if (alpha > 0) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.textAlign   = "center";
          ctx.shadowColor = "rgba(255,40,40,0.95)";
          ctx.shadowBlur  = 30;
          ctx.font        = "bold 30px monospace";
          ctx.fillStyle   = "#ff3333";
          ctx.fillText("⚠  CRITICAL HEAT", canvas.width / 2, canvas.height / 2 - 50);
          ctx.font        = "bold 14px monospace";
          ctx.fillStyle   = "#ff8888";
          ctx.shadowBlur  = 12;
          ctx.fillText(`COLOR MATCH NOW SCORES ×3`, canvas.width / 2, canvas.height / 2 - 20);
          ctx.restore();
        }
        criticalHeatTimer--;
      }
    }

    // Floating Z's that drift up from the ball when exhaustion kicks in (rallyHits >= 30)
    function drawDrowsyFX(hr) {
      if (!drowsyZs.length) return;
      const fade = Math.min(1, (rallyHits - 30) / 10);
      ctx.save();
      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      for (const z of drowsyZs) {
        const t = z.life / z.maxLife;
        // Fade in quickly, hold, then fade out
        const alpha = fade * Math.min(1, t * 6) * Math.min(1, (1 - t) * 3 + 0.2);
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.font        = `bold ${Math.round(z.size)}px monospace`;
        ctx.shadowColor = "rgba(140,210,255,0.85)";
        ctx.shadowBlur  = 10;
        ctx.fillStyle   = "#c8e8ff";
        ctx.save();
        ctx.translate(z.x, z.y);
        ctx.rotate(z.rot);
        ctx.fillText("Z", 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;
      ctx.restore();
    }

    // Screen-space warning banner that flashes once when exhaustion first triggers,
    // plus a subtle persistent pulse while the ball stays drowsy.
    function drawDrowsyWarning() {
      if (rallyHits < 30 || bossModeActive || preBossActive || gameOver) return;
      ctx.save();
      ctx.textAlign = "center";

      // One-shot flash banner (same style as CRITICAL HEAT)
      if (drowsyWarningTimer > 0) {
        const p     = drowsyWarningTimer / 210;
        const alpha = Math.min(1, p * 5) * Math.min(1, (1 - p) * 4 + 0.05);
        ctx.globalAlpha = alpha;
        ctx.font        = "bold 28px monospace";
        ctx.fillStyle   = "#99d6ff";
        ctx.shadowColor = "rgba(100,190,255,0.95)";
        ctx.shadowBlur  = 28;
        ctx.fillText("💤  BALL DROWSY", canvas.width / 2, canvas.height / 2 - 46);
        ctx.font        = "bold 13px monospace";
        ctx.fillStyle   = "#77aacc";
        ctx.shadowBlur  = 10;
        ctx.fillText("EXHAUSTION RISING — WOBBLE INCREASING", canvas.width / 2, canvas.height / 2 - 18);
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
      }

      // Persistent ambient pulse in the corner while still drowsy
      const persistAlpha = Math.min(0.7, (rallyHits - 30) / 15) *
                           (0.45 + 0.35 * Math.sin(Date.now() * 0.0035));
      if (persistAlpha > 0.05) {
        ctx.globalAlpha = persistAlpha;
        ctx.font        = "bold 13px monospace";
        ctx.fillStyle   = "#aad8ff";
        ctx.shadowColor = "rgba(100,190,255,0.7)";
        ctx.shadowBlur  = 10;
        ctx.textAlign   = "left";
        ctx.fillText(`💤 DROWSY  ×${rallyHits - 29}`, 18, canvas.height - 54);
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PROGRESSION RENDERING — XP Bar, Floats, Level-Up, Perk Select, Summary
    // ═══════════════════════════════════════════════════════════════════════
    function drawHeatBar() {
      if (currentScreen !== "game" || progScreen || !modeSelected || gameOver) return;
      const W     = canvas.width;
      const H     = canvas.height;
      const barH  = 5;
      const barX  = 20;
      const barW  = W - 40;
      // Sit just above the XP bar (XP bar is at H-7, labels at H-12)
      const barY  = H - 26;
      const lblY  = H - 30;

      // Use the EXACT same rounded value the HUD text shows so they are always identical
      const heatPct = Math.round(heat);   // 0-100, matches "HEAT: N%" in HUD
      const pct     = heatPct / 100;      // 0-1 for fill
      const fillW   = barW * pct;
      const nexusHeat = currentArenaId === "blackhole";

      ctx.save();

      // Track (full width, dim)
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(barX, barY, barW, barH);

      // Filled — full-width gradient CLIPPED to fillW so colour is always proportional
      if (fillW > 0) {
        const g = ctx.createLinearGradient(barX, 0, barX + barW, 0); // full width
        if (nexusHeat) {
          g.addColorStop(0,    "#2a0038");
          g.addColorStop(0.45, "#b100d3");
          g.addColorStop(1,    "#f1a6ff");
        } else {
          g.addColorStop(0,    "#67efff");
          g.addColorStop(0.55, "#c084fc");
          g.addColorStop(1,    "#ff58d9");
        }
        const critPulse = criticalHeat ? (0.6 + Math.abs(Math.sin(Date.now()*0.008)) * 0.4) : 0;
        ctx.shadowColor = criticalHeat
          ? `rgba(255,40,40,${critPulse})`
          : pct > 0.8 ? `rgba(255,88,217,${0.5 + pct * 0.4})`
          : `rgba(103,239,255,${0.3 + pct * 0.4})`;
        ctx.shadowBlur = criticalHeat ? (14 + critPulse * 10) : (6 + pct * 8);
        ctx.fillStyle   = g;
        ctx.fillRect(barX, barY, fillW, barH);
        ctx.shadowBlur  = 0;
      }

      // "HEAT" label left
      ctx.font      = "bold 10px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = pct > 0.85
        ? (nexusHeat ? `rgba(177,0,211,${0.75 + pct * 0.25})` : `rgba(255,88,217,${0.75 + pct * 0.25})`)
        : (nexusHeat ? "rgba(177,0,211,0.76)" : "rgba(255,88,217,0.7)");
      ctx.fillText("HEAT", barX, lblY);

      // Percentage right — identical to HUD text value
      ctx.textAlign = "right";
      ctx.fillStyle = nexusHeat ? "rgba(177,0,211,0.68)" : "rgba(255,88,217,0.55)";
      ctx.font      = "9px monospace";
      ctx.fillText(`${heatPct}%`, barX + barW, lblY);

      ctx.restore();
    }

    function drawXPBar() {
      if (currentScreen !== "game" || progScreen) return;
      const W = canvas.width;
      const H = canvas.height;
      const barH = 5;
      const barY = H - barH - 2;
      const barW = W - 40;
      const barX = 20;
      const prog = GlitchProgression.xpProgress();
      const lvl  = GlitchProgression.level;

      // track glow decay
      xpBarGlow = Math.max(0, xpBarGlow - 0.025);

      // Background track
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(barX, barY, barW, barH);

      // Filled portion
      const fillW = barW * prog;
      const glowAlpha = 0.55 + xpBarGlow * 0.45;
      ctx.shadowColor = `rgba(103,239,255,${glowAlpha})`;
      ctx.shadowBlur  = 8 + xpBarGlow * 12;
      const grad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
      grad.addColorStop(0,   "rgba(103,239,255,0.7)");
      grad.addColorStop(0.6, "rgba(103,239,255,0.9)");
      grad.addColorStop(1,   "rgba(200,255,255,1.0)");
      ctx.fillStyle = grad;
      ctx.fillRect(barX, barY, fillW, barH);
      ctx.shadowBlur = 0;

      // Level label
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = `rgba(103,239,255,${0.65 + xpBarGlow * 0.35})`;
      ctx.textAlign = "left";
      ctx.fillText(`LVL ${lvl}`, barX, barY - 7);

      // XP numbers
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(103,239,255,0.45)";
      ctx.font = "9px monospace";
      ctx.fillText(`${GlitchProgression.xp} / ${GlitchProgression.xpToNext()} XP`, barX + barW, barY - 7);
      ctx.restore();
    }

    function drawXPFloats() {
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "bold 13px monospace";
      for (let i = xpFloats.length - 1; i >= 0; i--) {
        const f = xpFloats[i];
        f.y += f.vy;
        f.life--;
        if (f.life <= 0) { xpFloats.splice(i, 1); continue; }
        const alpha = Math.min(1, f.life / 20) * 0.9;
        ctx.shadowColor = "rgba(103,239,255,0.8)";
        ctx.shadowBlur  = 6;
        ctx.fillStyle   = `rgba(103,239,255,${alpha})`;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    function drawLevelUpScreen() {
      if (progScreen !== "levelUp") return;
      progScreenTimer--;
      const t = Math.max(0, 180 - progScreenTimer) / 180;
      const alpha = Math.min(1, t * 3);

      ctx.save();
      // dark overlay
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.78})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // scanlines
      for (let i = 0; i < canvas.height; i += 4) {
        ctx.fillStyle = `rgba(0,0,0,${0.08 * alpha})`;
        ctx.fillRect(0, i, canvas.width, 2);
      }

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const compact = isMobileDevice || canvas.height < 560 || canvas.width < 840;
      const panelHalfW = Math.min(160, canvas.width / 2 - 24);

      // Glitch chromatic shift
      const glitchOff = Math.sin(Date.now() * 0.03) * 3 * alpha;

      ctx.shadowBlur = 40;
      ctx.shadowColor = "rgba(103,239,255,0.9)";

      // Top line
      ctx.fillStyle = `rgba(103,239,255,${alpha * 0.6})`;
      ctx.fillRect(cx - panelHalfW, cy - 90, panelHalfW * 2, 1);
      ctx.fillRect(cx - panelHalfW, cy + 90, panelHalfW * 2, 1);

      // Main header
      ctx.font = `bold ${Math.round(13 * alpha + 2)}px monospace`;
      ctx.fillStyle = `rgba(103,239,255,${alpha})`;
      ctx.textAlign = "center";
      ctx.fillText("SYSTEM UPGRADE COMPLETE", cx + glitchOff, cy - 60);

      // Level number — big
      ctx.shadowColor = "rgba(255,255,255,0.8)";
      ctx.font = `bold ${compact ? 40 : 52}px monospace`;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillText(`LEVEL ${progLevelData.level}`, cx - glitchOff * 2, cy);

      // Title
      ctx.font = `bold 14px monospace`;
      ctx.fillStyle = `rgba(255,209,102,${alpha * 0.9})`;
      ctx.shadowColor = "rgba(255,209,102,0.7)";
      ctx.fillText(GlitchProgression.getTitle(progLevelData.level), cx + glitchOff, cy + 30);

      // Subtext
      ctx.font = "12px monospace";
      ctx.fillStyle = `rgba(200,255,255,${alpha * 0.6})`;
      ctx.shadowBlur = 0;
      ctx.fillText("NEW COMBAT MODULE INSTALLED", cx, cy + 58);
      ctx.fillText(compact ? "TAP  TO  CONTINUE" : "PRESS  ENTER  TO  CONTINUE", cx, cy + 76);

      // XP bar progress
      const barW = Math.min(280, canvas.width - 60), barH = 4;
      const barX = cx - barW / 2, barY = cy + 94;
      ctx.fillStyle = `rgba(255,255,255,0.1)`;
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = `rgba(103,239,255,${alpha * 0.85})`;
      ctx.shadowColor = "rgba(103,239,255,0.8)";
      ctx.shadowBlur  = 8;
      ctx.fillRect(barX, barY, barW * GlitchProgression.xpProgress(), barH);
      ctx.shadowBlur  = 0;

      ctx.restore();

      if (progScreenTimer <= 0) {
        // Check if perk selection is queued
        const perkLevels = GlitchProgression.drainPerkChoices();
        if (perkLevels.length > 0) {
          progScreen      = "perkSelect";
          progPerkOptions = GlitchProgression.getRandomPerks(3);
          progSelectedPerk = 0;
          progScreenTimer = 0;
        } else {
          progScreen = null;
          processPendingLevelUps();
        }
      }
    }

    function drawPerkSelectScreen() {
      if (progScreen !== "perkSelect") return;
      const t = Math.min(1, (progScreenTimer / 30));
      progScreenTimer++;
      const alpha = Math.min(1, progScreenTimer / 20);

      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${0.88 * alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // scanlines
      for (let i = 0; i < canvas.height; i += 4) {
        ctx.fillStyle = `rgba(0,0,0,${0.10 * alpha})`;
        ctx.fillRect(0, i, canvas.width, 2);
      }

      const cx = canvas.width / 2;
      const lvl = progLevelData ? progLevelData.level : GlitchProgression.level;
      const compact = isMobileDevice || canvas.height < 560 || canvas.width < 840;

      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(255,79,216,0.9)";
      ctx.shadowBlur  = 24;
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = `rgba(255,79,216,${alpha * 0.8})`;
      ctx.fillText(`LEVEL ${lvl} — NEW COMBAT MODULES AVAILABLE`, cx, 56);

      ctx.font = "bold 22px monospace";
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.shadowColor = "rgba(103,239,255,0.7)";
      ctx.fillText("SELECT AN UPGRADE", cx, 84);

      ctx.shadowBlur = 0;
      ctx.font = "10px monospace";
      ctx.fillStyle = `rgba(200,255,255,${alpha * 0.5})`;
      ctx.fillText(compact ? "TAP A MODULE TO INSTALL" : "USE [1] [2] [3] TO SELECT  //  ENTER TO CONFIRM", cx, 102);

      const cardW = Math.min(260, (canvas.width - 80) / 3);
      const cardH = compact ? Math.max(118, Math.min(160, canvas.height - 158)) : 180;
      const gap   = compact ? 8 : 18;
      const totalW = cardW * 3 + gap * 2;
      const startX = cx - totalW / 2;
      const cardY  = compact ? 112 : canvas.height / 2 - cardH / 2 + 20;

      progPerkOptions.forEach((perk, i) => {
        const x = startX + i * (cardW + gap);
        const selected = progSelectedPerk === i;
        const borderC = selected ? "rgba(103,239,255,0.9)" : "rgba(103,239,255,0.25)";
        const bgC     = selected ? "rgba(103,239,255,0.12)" : "rgba(103,239,255,0.04)";
        const glowB   = selected ? 18 : 0;

        ctx.save();
        ctx.shadowColor = "rgba(103,239,255,0.7)";
        ctx.shadowBlur  = glowB;
        ctx.fillStyle   = bgC;
        ctx.strokeStyle = borderC;
        ctx.lineWidth   = selected ? 2 : 1;
        roundRect(ctx, x, cardY, cardW, cardH, 10);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Key label
        ctx.font = "bold 13px monospace";
        ctx.fillStyle = selected ? "rgba(255,209,102,1)" : "rgba(255,209,102,0.5)";
        ctx.textAlign = "center";
        ctx.fillText(PERK_KEYS[i], x + cardW / 2, cardY + 22);

        // Perk name
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = selected ? "rgba(103,239,255,1)" : "rgba(103,239,255,0.65)";
        wrapText(ctx, perk.name, x + cardW / 2, cardY + 46, cardW - 20, 15);

        // Separator
        ctx.fillStyle = selected ? "rgba(103,239,255,0.4)" : "rgba(103,239,255,0.15)";
        ctx.fillRect(x + 16, cardY + 74, cardW - 32, 1);

        // Description
        ctx.font = `${compact ? 9 : 11}px monospace`;
        ctx.fillStyle = selected ? "rgba(220,255,255,0.85)" : "rgba(160,200,200,0.55)";
        wrapText(ctx, perk.desc, x + cardW / 2, cardY + 96, cardW - 20, compact ? 13 : 16);
        ctx.restore();
      });

      // Confirm prompt
      ctx.textAlign = "center";
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = `rgba(103,239,255,${alpha * 0.6 + Math.sin(Date.now()*0.004)*0.2})`;
      ctx.fillText(compact ? "TAP TO CHOOSE" : "PRESS  ENTER  TO  INSTALL  MODULE", cx, Math.min(canvas.height - 14, cardY + cardH + 32));

      ctx.restore();
    }

    function drawMatchSummary() {
      if (progScreen !== "matchSummary" || !progSummaryData) return;
      progSummaryTimer++;
      const alpha  = Math.min(1, progSummaryTimer / 20);
      const reveal = Math.min(1, Math.max(0, (progSummaryTimer - 18) / 40));
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const d  = progSummaryData;
      const compact = isMobileDevice || canvas.height < 560 || canvas.width < 840;
      const safeX = Math.max(18, Math.min(42, canvas.width * 0.045));

      ctx.save();

      // Dark full-screen backdrop
      ctx.fillStyle = `rgba(0,0,0,${0.90 * alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Scanlines
      for (let i = 0; i < canvas.height; i += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.07)";
        ctx.fillRect(0, i, canvas.width, 2);
      }

      const winnerLabel = matchWinner === "left" ? "LEFT PLAYER WINS" : "RIGHT PLAYER WINS";
      const winnerColor = matchWinner === "left" ? "#67efff" : "#ff8fab";
      const winnerGlow  = matchWinner === "left" ? "rgba(103,239,255,0.8)" : "rgba(255,79,216,0.8)";

      // ── 1. WINNER ─────────────────────────────────────────────────────────
      ctx.textAlign = "center";
      ctx.shadowColor = winnerGlow;
      ctx.shadowBlur  = 32 * alpha;
      const winnerSize = compact
        ? Math.round(Math.min(34, Math.max(22, canvas.width * 0.047)) * alpha + 2)
        : Math.round(42 * alpha + 4);
      const winnerY = compact ? Math.max(42, canvas.height * 0.105) : cy - 118;
      ctx.font = `bold ${winnerSize}px monospace`;
      ctx.fillStyle = winnerColor;
      ctx.fillText(winnerLabel, cx, winnerY, canvas.width - safeX * 2);
      ctx.shadowBlur = 0;

      // Thin separator under winner
      ctx.fillStyle = `rgba(255,255,255,${0.12 * alpha})`;
      const separatorY = compact ? winnerY + 16 : cy - 98;
      const separatorW = Math.min(320, canvas.width - safeX * 2);
      ctx.fillRect(cx - separatorW / 2, separatorY, separatorW, 1);

      // ── 2. XP TOTAL ───────────────────────────────────────────────────────
      const xpCount  = Math.round((d.totalXP || 0) * Math.min(1, Math.max(0, (progSummaryTimer - 20) / 50)));
      ctx.shadowColor = "rgba(103,239,255,0.7)";
      ctx.shadowBlur  = 16 * reveal;
      ctx.font = `bold ${compact ? 24 : 30}px monospace`;
      ctx.fillStyle = `rgba(103,239,255,${reveal})`;
      const xpY = compact ? separatorY + 38 : cy - 66;
      ctx.fillText(`+${xpCount} XP`, cx, xpY);
      ctx.shadowBlur = 0;

      // ── 3. BREAKDOWN ──────────────────────────────────────────────────────
      ctx.font = `${compact ? 10 : 11}px monospace`;
      const reasons = Object.entries(d.breakdown || {});
      const promptReserve = compact ? 76 : 60;
      const levelReserve = d.levelBefore !== d.levelAfter ? (compact ? 48 : 50) : 12;
      const availableRowsH = Math.max(72, canvas.height - (xpY + 24) - promptReserve - levelReserve);
      const rowH = compact
        ? Math.max(14, Math.min(19, availableRowsH / Math.max(1, reasons.length)))
        : 21;
      const tableTop = compact ? xpY + 25 : cy - 40;
      const tableHalfW = Math.min(120, canvas.width / 2 - safeX);
      reasons.forEach(([reason, amt], i) => {
        const ra = Math.min(1, Math.max(0, (progSummaryTimer - 28 - i * 5) / 18));
        if (ra <= 0) return;
        const rowY = tableTop + i * rowH;
        const label = reason.replace(/([A-Z])/g, " $1").toUpperCase().trim();
        ctx.textAlign = "left";
        ctx.fillStyle = `rgba(160,220,220,${ra * 0.65})`;
        ctx.fillText(label, cx - tableHalfW, rowY);
        ctx.textAlign = "right";
        ctx.fillStyle = `rgba(103,239,255,${ra * 0.90})`;
        ctx.fillText(`+${amt}`, cx + tableHalfW, rowY);
      });

      // Thin separator above level line
      const afterTable = tableTop + reasons.length * rowH + 8;
      if (reveal > 0.2) {
        ctx.fillStyle = `rgba(255,255,255,${0.10 * reveal})`;
        ctx.fillRect(cx - tableHalfW, afterTable, tableHalfW * 2, 1);
      }

      // ── 4. LEVEL CHANGE (if any) ──────────────────────────────────────────
      if (d.levelBefore !== d.levelAfter) {
        const la = Math.min(1, Math.max(0, (progSummaryTimer - 50 - reasons.length * 5) / 20));
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(255,209,102,0.9)";
        ctx.shadowBlur  = 12 * la;
        ctx.font = `bold ${compact ? 12 : 14}px monospace`;
        ctx.fillStyle = `rgba(255,209,102,${la})`;
        ctx.fillText(`LEVEL ${d.levelBefore}  →  LEVEL ${d.levelAfter}`, cx, afterTable + 22);
        ctx.shadowBlur = 0;
        ctx.font = `${compact ? 10 : 11}px monospace`;
        ctx.fillStyle = `rgba(200,255,200,${la * 0.7})`;
        ctx.fillText(GlitchProgression.getTitle(d.levelAfter), cx, afterTable + 40);
      }

      // ── 5. PRESS R ────────────────────────────────────────────────────────
      const showPrompt = progSummaryTimer > 55;
      if (showPrompt) {
        const pa = Math.min(1, (progSummaryTimer - 55) / 18) * (0.65 + Math.sin(Date.now() * 0.004) * 0.28);
        ctx.textAlign = "center";
        if (compact) {
          const gap = 10;
          const buttonY = canvas.height - 54;
          const buttonH = 38;
          const buttonW = (canvas.width - safeX * 2 - gap) / 2;
          const drawTouchButton = (x, label, color, fill) => {
            ctx.shadowColor = color;
            ctx.shadowBlur = 7;
            ctx.fillStyle = fill;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            roundRect(ctx, x, buttonY, buttonW, buttonH, 8);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = color;
            ctx.font = "bold 11px monospace";
            ctx.fillText(label, x + buttonW / 2, buttonY + 24);
          };
          ctx.globalAlpha = pa;
          drawTouchButton(safeX, "MENU", "#ffd27a", "rgba(255,209,102,0.09)");
          drawTouchButton(safeX + buttonW + gap, "LEVEL DETAILS", "#67efff", "rgba(103,239,255,0.09)");
          ctx.globalAlpha = 1;
          ctx.restore();
          return;
        }
        ctx.shadowColor = "rgba(255,209,102,0.6)";
        ctx.shadowBlur  = 8;
        ctx.font = "bold 13px monospace";
        ctx.fillStyle = `rgba(255,209,102,${pa})`;
        ctx.fillText("PRESS  R  —  RETURN  TO  MENU", cx, canvas.height - 38);
        ctx.shadowBlur = 0;
        ctx.font = "10px monospace";
        ctx.fillStyle = `rgba(103,239,255,${pa * 0.5})`;
        ctx.fillText("ENTER  —  VIEW  LEVEL  DETAILS", cx, canvas.height - 20);
      }

      ctx.restore();
    }

    // Helper: rounded rect
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    // Helper: wrapped text
    function wrapText(ctx, text, cx, y, maxW, lineH) {
      const words = text.split(" ");
      let line = "";
      words.forEach(word => {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width > maxW) {
          ctx.fillText(line, cx, y);
          line = word;
          y += lineH;
        } else {
          line = test;
        }
      });
      if (line) ctx.fillText(line, cx, y);
    }


    // ═══════════════════════════════════════════════════════════════════════
    // GLITCH WALL SYSTEM — Sentient Arena Corruption
    // ═══════════════════════════════════════════════════════════════════════
    const WALL_CHUNK = 9; // base pixel-chunk size

    function makeWallChunks(w, h) {
      const chunks = [];
      for (let py = 0; py < h; py += WALL_CHUNK) {
        for (let px = 0; px < w; px += WALL_CHUNK) {
          if (Math.random() < 0.78) {
            const jx = (Math.random() - 0.5) * 3;
            const jy = (Math.random() - 0.5) * 3;
            const cw = WALL_CHUNK - 1 + Math.floor(Math.random() * 3);
            const ch = WALL_CHUNK - 1 + Math.floor(Math.random() * 3);
            const r = Math.random();
            chunks.push({
              ox: px + jx, oy: py + jy, w: cw, h: ch,
              color: r < 0.52 ? "#00c4d4" : r < 0.80 ? "#ff4fd8" : "#ffffff",
              base:  0.70 + Math.random() * 0.30,
              spd:   0.07 + Math.random() * 0.14,
              phase: Math.random() * Math.PI * 2
            });
          }
        }
      }
      return chunks;
    }

    function makeWallFragments(wall) {
      const frags = [];
      for (const c of wall.chunks) {
        if (Math.random() < 0.65) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 1.5 + Math.random() * 3.5;
          const life = 22 + Math.floor(Math.random() * 24);
          frags.push({
            x: wall.x + c.ox + c.w / 2,
            y: wall.y + c.oy + c.h / 2,
            vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
            w: c.w, h: c.h,
            color: c.color,
            alpha: 1, life, maxLife: life,
            rot: (Math.random() - 0.5) * 0.28, angle: 0
          });
        }
      }
      return frags;
    }

    function wallSpawnOK(wx, wy, ww, wh) {
      // Keep away from goal edges
      if (wx < leftX + paddleW + 52) return false;
      if (wx + ww > rightX - 52)     return false;
      if (wy < 24 || wy + wh > canvas.height - 24) return false;

      // Generous padding around each paddle (so they never trap a paddle)
      const PAD = 64;
      const lOverlap = wx < leftX + paddleW + PAD && wx + ww > leftX - PAD &&
                       wy < leftY + paddleH + PAD && wy + wh > leftY - PAD;
      const rOverlap = wx < rightX + paddleW + PAD && wx + ww > rightX - PAD &&
                       wy < rightY + paddleH + PAD && wy + wh > rightY - PAD;
      if (lOverlap || rOverlap) return false;

      // Safe distance from ball
      const bSafe = 110;
      if (Math.abs(ballX - (wx + ww / 2)) < bSafe &&
          Math.abs(ballY - (wy + wh / 2)) < bSafe) return false;

      // Don't spawn directly in ball's immediate path
      const LOOK = 160;
      if (vx < 0 && wx < ballX && wx + ww > ballX - LOOK &&
          wy < ballY + 28 && wy + wh > ballY - 28) return false;
      if (vx > 0 && wx + ww > ballX && wx < ballX + LOOK &&
          wy < ballY + 28 && wy + wh > ballY - 28) return false;

      // No overlap with existing walls
      for (const e of glitchWalls) {
        if (e.phase === 'dying') continue;
        if (wx < e.x + e.w + 18 && wx + ww > e.x - 18 &&
            wy < e.y + e.h + 18 && wy + wh > e.y - 18) return false;
      }
      return true;
    }

    function trySpawnGlitchWall() {
      if (roundFrozen || !modeSelected || gameOver || bossModeActive || finalScoreCinematic) return;
      const hr = getHeatRatio();
      if (hr < 0.30) return;

      const maxWalls = hr < 0.50 ? 1 : hr < 0.65 ? 2 : hr < 0.80 ? 3 : 5;
      const active = glitchWalls.filter(w => w.phase !== 'dying').length;
      if (active >= maxWalls) return;

      const safeX1 = leftX + paddleW + 55;
      const safeX2 = rightX - 55;
      const safeY1 = 28;
      const safeY2 = canvas.height - 28;

      for (let attempt = 0; attempt < 14; attempt++) {
        const horiz = Math.random() < 0.55;
        const ww = horiz ? 44 + Math.floor(Math.random() * 72) : 18 + Math.floor(Math.random() * 26);
        const wh = horiz ? 16 + Math.floor(Math.random() * 22) : 40 + Math.floor(Math.random() * 68);
        const wx = safeX1 + Math.floor(Math.random() * Math.max(1, safeX2 - safeX1 - ww));
        const wy = safeY1 + Math.floor(Math.random() * Math.max(1, safeY2 - safeY1 - wh));
        if (!wallSpawnOK(wx, wy, ww, wh)) continue;

        const warnDur  = 28 + Math.floor(Math.random() * 32);
        const solidDur = 200 + Math.floor(hr * 180 + Math.random() * 120);
        glitchWalls.push({
          x: wx, y: wy, w: ww, h: wh,
          phase: 'warning',
          warningTimer: warnDur, warningMax: warnDur,
          solidTimer: solidDur,
          dyingTimer: 0, dyingMax: 52,
          chunks: makeWallChunks(ww, wh),
          fragments: [],
          rgbOff: 1 + Math.floor(Math.random() * 3),
          scanOff: Math.floor(Math.random() * 8)
        });
        return;
      }
    }

    function updateGlitchWalls() {
      for (let i = glitchWalls.length - 1; i >= 0; i--) {
        const wall = glitchWalls[i];
        if (wall.phase === 'warning') {
          if (--wall.warningTimer <= 0) wall.phase = 'solid';
        } else if (wall.phase === 'solid') {
          if (--wall.solidTimer <= 0) {
            wall.phase = 'dying';
            wall.dyingTimer = wall.dyingMax;
            wall.fragments = makeWallFragments(wall);
          }
        } else { // dying
          for (let j = wall.fragments.length - 1; j >= 0; j--) {
            const f = wall.fragments[j];
            f.x += f.vx; f.y += f.vy;
            f.vy += 0.11; f.vx *= 0.96;
            f.angle += f.rot;
            f.alpha = f.life / f.maxLife;
            if (--f.life <= 0) wall.fragments.splice(j, 1);
          }
          if (--wall.dyingTimer <= 0 && wall.fragments.length === 0) {
            glitchWalls.splice(i, 1);
          }
        }
      }
    }

    function checkGlitchWallCollisions() {
      for (const wall of glitchWalls) {
        if (wall.phase !== 'solid') continue;
        const bL = ballX - BALL_R, bR = ballX + BALL_R;
        const bT = ballY - BALL_R, bB = ballY + BALL_R;
        const wL = wall.x, wR = wall.x + wall.w;
        const wT = wall.y, wB = wall.y + wall.h;
        if (bR <= wL || bL >= wR || bB <= wT || bT >= wB) continue;

        const dL = bR - wL, dR = wR - bL, dT = bB - wT, dB = wB - bT;
        const mn = Math.min(dL, dR, dT, dB);
        if      (mn === dL) { vx = -Math.abs(vx); ballX = wL - BALL_R - 1; }
        else if (mn === dR) { vx =  Math.abs(vx); ballX = wR + BALL_R + 1; }
        else if (mn === dT) { vy = -Math.abs(vy); ballY = wT - BALL_R - 1; }
        else                { vy =  Math.abs(vy); ballY = wB + BALL_R + 1; }

        // Shatter on ball contact
        wall.phase = 'dying';
        wall.dyingTimer = wall.dyingMax;
        wall.fragments = makeWallFragments(wall);
        glitchPulse = Math.max(glitchPulse, 16);
        triggerCameraKick((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, 0.009);
        pongAudio.glitch();
        break;
      }
    }

    function drawGlitchWalls() {
      if (!glitchWalls.length) return;
      const now = Date.now();
      ctx.save();

      for (const wall of glitchWalls) {

        if (wall.phase === 'warning') {
          const prog = 1 - wall.warningTimer / wall.warningMax;
          // Rapid flicker — sin wave at high frequency
          const flicker = Math.sin(now * 0.045 + prog * 22) > 0.15;
          if (!flicker) continue;
          const alpha = 0.12 + prog * 0.38;
          const ro = wall.rgbOff * (1.4 - prog);

          for (const c of wall.chunks) {
            if (Math.sin(now * 0.09 + c.phase) < 0) continue;
            // RGB split ghost
            ctx.globalAlpha = alpha * 0.55;
            ctx.fillStyle = "#ff0040";
            ctx.fillRect(wall.x + c.ox - ro, wall.y + c.oy, c.w, c.h);
            ctx.fillStyle = "#00ffff";
            ctx.fillRect(wall.x + c.ox + ro, wall.y + c.oy, c.w, c.h);
            // Main chunk
            ctx.globalAlpha = alpha;
            ctx.fillStyle = c.color;
            ctx.fillRect(wall.x + c.ox, wall.y + c.oy, c.w, c.h);
          }

          // Animated scanlines
          ctx.globalAlpha = 0.20 * alpha;
          ctx.fillStyle = "#ffffff";
          const scanStart = (now * 0.06 + wall.scanOff) % 6;
          for (let sy = wall.y + scanStart; sy < wall.y + wall.h; sy += 6) {
            ctx.fillRect(wall.x, sy, wall.w, 1);
          }
          // Pixel static noise
          ctx.globalAlpha = 0.12 * alpha;
          for (let n = 0; n < 6; n++) {
            ctx.fillStyle = Math.random() > 0.5 ? "#00c4d4" : "#ff4fd8";
            ctx.fillRect(
              wall.x + Math.random() * wall.w,
              wall.y + Math.random() * wall.h,
              Math.random() * 4 + 1, Math.random() * 4 + 1
            );
          }
          ctx.globalAlpha = 1;

        } else if (wall.phase === 'solid') {
          for (const c of wall.chunks) {
            const flicker = Math.sin(now * c.spd + c.phase);
            const alpha = c.base * (0.82 + flicker * 0.18);
            if (alpha < 0.08) continue;
            ctx.globalAlpha = alpha;

            // Occasional per-chunk RGB split
            if (flicker > 0.72 && wall.rgbOff >= 2) {
              ctx.fillStyle = "rgba(255,0,64,0.55)";
              ctx.fillRect(wall.x + c.ox - wall.rgbOff, wall.y + c.oy, c.w, c.h);
              ctx.fillStyle = "rgba(0,255,255,0.55)";
              ctx.fillRect(wall.x + c.ox + wall.rgbOff, wall.y + c.oy, c.w, c.h);
            }
            ctx.shadowColor = c.color === "#ff4fd8" ? "rgba(255,79,216,0.75)" : "rgba(103,239,255,0.75)";
            ctx.shadowBlur = 5;
            ctx.fillStyle = c.color;
            ctx.fillRect(wall.x + c.ox, wall.y + c.oy, c.w, c.h);
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;

          // Moving scanline through wall body
          const scanY = wall.y + (now * 0.055 + wall.scanOff) % (wall.h + 6);
          ctx.globalAlpha = 0.20;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(wall.x, scanY, wall.w, 2);
          ctx.globalAlpha = 1;

          // Jagged live edges (top/bottom corruption fringe)
          ctx.globalAlpha = 0.30;
          ctx.fillStyle = "#00c4d4";
          for (let ex = wall.x; ex < wall.x + wall.w; ex += 4) {
            const n = Math.sin(now * 0.018 + ex * 0.35) * 3;
            ctx.fillRect(ex, wall.y + n, 3, 2);
            ctx.fillRect(ex, wall.y + wall.h + n - 2, 3, 2);
          }
          ctx.globalAlpha = 1;

        } else { // dying — scattered fragments
          for (const f of wall.fragments) {
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.angle);
            ctx.globalAlpha = f.alpha;
            ctx.shadowColor = f.color;
            ctx.shadowBlur = 5;
            ctx.fillStyle = f.color;
            ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
            ctx.restore();
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }

    function clearGlitchWalls() {
      glitchWalls = [];
      glitchWallSpawnCooldown = 240;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ARENA SYSTEM — Registry, State, Matrix Mainframe Renderer
    // ═══════════════════════════════════════════════════════════════════════

    // ── Registry: add new arenas here ──────────────────────────────────────
    const ARENA_REGISTRY = [
      {
        id:       "classic",
        name:     "GLITCH ARENA",
        subtitle: "Standard // Default",
        desc:     "The original corrupted battleground. Pure pong. Maximum chaos.",
        tags:     ["Classic", "Balanced"],
        accent:   "#71efff",
        gradient: "linear-gradient(135deg,rgba(3,14,20,0.9) 0%,rgba(0,30,40,0.7) 100%)",
        hasOverlay: false,
        init:     null,
        cleanup:  null
      },
      {
        id:       "matrix",
        name:     "MATRIX MAINFRAME",
        subtitle: "Digital Simulation // Unstable",
        desc:     "Inside the code. Reality becomes suspect. The simulation is aware of you.",
        tags:     ["Digital Rain", "Data Streams", "Heat Unstable"],
        accent:   "#50fa7b",
        gradient: "linear-gradient(135deg,rgba(0,8,0,0.95) 0%,rgba(0,24,8,0.8) 100%)",
        hasOverlay: true,
        init:     initMatrixArena,
        cleanup:  cleanupMatrixArena
      },
      {
        id:       "construct",
        name:     "THE CONSTRUCT",
        subtitle: "Energy Grid // Corrupting",
        desc:     "A flawless neon simulation slowly breaking apart under the pressure of the rally.",
        tags:     ["Energy Grid", "Cyan Void", "Heat Reactive"],
        accent:   "#58ecff",
        gradient: "linear-gradient(135deg,rgba(0,9,18,0.96) 0%,rgba(0,36,55,0.78) 100%)",
        hasOverlay: true,
        init:     initConstructArena,
        cleanup:  cleanupConstructArena
      },
      {
        id:       "blackhole",
        name:     "BLACK-HOLE NEXUS",
        subtitle: "Deep Space // Gravity Corrupt",
        desc:     "A cosmic convergence point where corrupted data meets astronomical chaos.",
        tags:     ["Gravity Zone", "Cosmic Glitch", "Heat Anomalies"],
        accent:   "#b100d3",
        gradient: "linear-gradient(135deg,rgba(0,18,51,0.96) 0%,rgba(28,0,48,0.82) 100%)",
        hasOverlay: true,
        init:     initBlackHoleNexusArena,
        cleanup:  cleanupBlackHoleNexusArena
      }
    ];

    let currentArenaId = "classic";
    let pendingTwoPlayer = false;

    function getArena() {
      return ARENA_REGISTRY.find(a => a.id === currentArenaId) || ARENA_REGISTRY[0];
    }

    const blackHoleState = {
      frame: 0,
      initialized: false,
      stars: [],
      anomalies: [],
      microHoles: [],
      anomalyCooldown: 120,
      microCooldown: 260,
      radialGlitchFrames: 0,
      radialGlitchTier: 0
    };

    function initBlackHoleNexusArena() {
      blackHoleState.frame = 0;
      blackHoleState.stars = [];
      blackHoleState.anomalies = [];
      blackHoleState.microHoles = [];
      blackHoleState.anomalyCooldown = 120;
      blackHoleState.microCooldown = 260;
      blackHoleState.radialGlitchFrames = 0;
      blackHoleState.radialGlitchTier = 0;
      const W = Math.max(1, canvas.width || 1920);
      const H = Math.max(1, canvas.height || 1080);
      for (let i = 0; i < 170; i++) {
        blackHoleState.stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          depth: 0.35 + Math.random() * 1.65,
          size: 0.7 + Math.random() * 1.8,
          twinkle: Math.random() * Math.PI * 2,
          tint: Math.random() < 0.55 ? "177,0,211" : Math.random() < 0.82 ? "225,120,255" : "225,232,255"
        });
      }
      blackHoleState.initialized = true;
    }

    function cleanupBlackHoleNexusArena() {
      blackHoleState.initialized = false;
      blackHoleState.stars = [];
      blackHoleState.anomalies = [];
      blackHoleState.microHoles = [];
      blackHoleState.radialGlitchFrames = 0;
    }

    function resetBlackHoleNexusGameplay() {
      blackHoleState.anomalies = [];
      blackHoleState.microHoles = [];
      blackHoleState.anomalyCooldown = 110 + Math.floor(Math.random() * 120);
      blackHoleState.microCooldown = 260 + Math.floor(Math.random() * 180);
      blackHoleState.radialGlitchFrames = 0;
      blackHoleState.radialGlitchTier = 0;
    }

    function drawBlackHoleBackdrop(hr) {
      if (!blackHoleState.initialized) initBlackHoleNexusArena();
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      const f = ++blackHoleState.frame;
      const quality = getVisualQualityScale();
      const maxR = Math.hypot(W, H) * 0.58;
      const coreR = Math.min(W, H) * (0.060 + hr * 0.026 + (preBossActive ? 0.035 : 0));
      const spin = f * (0.0048 + hr * 0.0032); // positive canvas rotation = clockwise

      // The Nexus is now the inside of the black hole: near-total black with
      // purple structure, not a space scene with a black hole sitting in it.
      const voidGrad = ctx.createRadialGradient(cx, cy, coreR * 0.5, cx, cy, maxR);
      voidGrad.addColorStop(0, "rgba(0,0,0,1)");
      voidGrad.addColorStop(0.34, "rgba(2,0,8,0.99)");
      voidGrad.addColorStop(0.68, "rgba(5,0,13,0.98)");
      voidGrad.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = voidGrad;
      ctx.fillRect(-80, -80, W + 160, H + 160);

      // Very faint purple fog so the arena feels deep but stays readable.
      const purpleFog = ctx.createRadialGradient(cx, cy, coreR, cx, cy, maxR * 0.92);
      purpleFog.addColorStop(0, `rgba(0,0,0,0.10)`);
      purpleFog.addColorStop(0.45, `rgba(177,0,211,${0.035 + hr * 0.030})`);
      purpleFog.addColorStop(0.78, `rgba(72,0,100,${0.050 + hr * 0.035})`);
      purpleFog.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = purpleFog;
      ctx.fillRect(0, 0, W, H);

      // A handful of dim particles are dragged around the vortex, like debris
      // already inside the singularity rather than normal stars in open space.
      const starStride = quality < 0.55 ? 12 : quality < 0.85 ? 8 : 6;
      for (let i = 0; i < blackHoleState.stars.length; i++) {
        if (i % starStride !== 0) continue;
        const star = blackHoleState.stars[i];
        const sx0 = star.x - cx;
        const sy0 = star.y - cy;
        const baseR = Math.max(coreR * 1.4, Math.hypot(sx0, sy0));
        const baseA = Math.atan2(sy0, sx0) + spin * (0.25 + star.depth * 0.34);
        const spiralR = ((baseR + f * 0.18 * star.depth) % maxR) + coreR * 1.3;
        const sx = cx + Math.cos(baseA + spiralR * 0.002) * spiralR;
        const sy = cy + Math.sin(baseA + spiralR * 0.002) * spiralR;
        const fade = Math.max(0, Math.min(1, (spiralR - coreR) / (maxR * 0.55)));
        ctx.fillStyle = `rgba(177,0,211,${0.045 * fade})`;
        ctx.fillRect(sx, sy, star.size, star.size);
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spin);

      // Rotating purple vortex lines. These span most of the playfield so the
      // whole arena reads as the inside wall of a rotating black hole.
      ctx.lineCap = "round";
      const armCount = Math.max(4, Math.round(10 * quality));
      const armSteps = Math.max(34, Math.round(76 * quality));
      for (let arm = 0; arm < armCount; arm++) {
        const armOffset = (Math.PI * 2 * arm) / armCount;
        const bright = arm % 3 === 0;
        ctx.beginPath();
        for (let step = 0; step <= armSteps; step++) {
          const t = step / armSteps;
          const r = coreR * 1.35 + t * maxR * 0.95;
          const twist = t * (Math.PI * (2.9 + hr * 1.15));
          const wobble = Math.sin(t * 14 + f * 0.032 + arm) * (0.030 + hr * 0.018);
          const a = armOffset + twist + wobble;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r * (0.80 + 0.06 * Math.sin(arm));
          if (step === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = bright
          ? `rgba(177,0,211,${0.28 + hr * 0.16})`
          : `rgba(96,0,150,${0.12 + hr * 0.11})`;
        ctx.lineWidth = bright ? (1.35 + hr * 0.85) : (0.75 + hr * 0.45);
        ctx.shadowColor = "rgba(177,0,211,0.58)";
        ctx.shadowBlur = bright ? 8 + hr * 8 : 0;
        ctx.stroke();
      }

      // Nested event-horizon rings rotating with the spiral wall.
      const ringCount = Math.max(3, Math.round(7 * quality));
      for (let i = 0; i < ringCount; i++) {
        const r = coreR * (2.1 + i * 1.55);
        if (r > maxR * 0.98) break;
        const alpha = (0.12 + hr * 0.08) * (1 - i / 14);
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * (0.76 + Math.sin(f * 0.018 + i) * 0.035), i * 0.23, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(177,0,211,${alpha})`;
        ctx.lineWidth = 0.9 + hr * 0.9;
        ctx.shadowColor = "rgba(177,0,211,0.42)";
        ctx.shadowBlur = i < 2 ? 7 + hr * 8 : 0;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();

      // Core singularity: the center stays truly black while the purple rim
      // makes the pull readable.
      const coreGlow = ctx.createRadialGradient(cx, cy, coreR * 0.4, cx, cy, coreR * 3.0);
      coreGlow.addColorStop(0, "rgba(0,0,0,1)");
      coreGlow.addColorStop(0.36, "rgba(0,0,0,1)");
      coreGlow.addColorStop(0.50, `rgba(177,0,211,${0.36 + hr * 0.20})`);
      coreGlow.addColorStop(0.62, `rgba(76,0,110,${0.18 + hr * 0.14})`);
      coreGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 3.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Thin court readability lines, bent by the vortex and kept purple.
      const rippleAmp = 1.0 + hr * 8;
      ctx.strokeStyle = `rgba(177,0,211,${0.055 + hr * 0.055})`;
      ctx.lineWidth = 1;
      for (let y = 46; y < H - 34; y += 34) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 30) {
          const d = Math.hypot(x - cx, y - cy);
          const ripple = Math.sin(d * 0.042 - f * 0.070) * rippleAmp * Math.max(0, 1 - d / (W * 0.70));
          if (x === 0) ctx.moveTo(x, y + ripple);
          else ctx.lineTo(x, y + ripple);
        }
        ctx.stroke();
      }

      if (hr > 0.2) {
        const edge = Math.max(0, (hr - 0.2) / 0.8);
        const edgeFragments = Math.max(3, Math.ceil((8 + edge * 16) * quality));
        for (let i = 0; i < edgeFragments; i++) {
          const y = Math.random() * H;
          const x = Math.random() < 0.5 ? Math.random() * 90 : W - 90 + Math.random() * 90;
          ctx.fillStyle = `rgba(177,0,211,${0.035 + edge * 0.070})`;
          ctx.fillRect(x, y, 18 + Math.random() * 90 * edge, 2 + Math.random() * 3);
        }
      }
    }

    function drawBlackHoleNexusOverlay(hr) {
      if (!blackHoleState.initialized) initBlackHoleNexusArena();
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      const f = blackHoleState.frame;
      const quality = getVisualQualityScale();

      for (const anomaly of blackHoleState.anomalies) {
        const p = anomaly.life / anomaly.maxLife;
        ctx.save();
        ctx.translate(anomaly.x, anomaly.y);
        ctx.rotate(anomaly.spin + f * 0.035 * anomaly.dir);
        ctx.globalAlpha = Math.min(0.65, p * 1.4);
        for (let i = 0; i < Math.max(1, Math.round(3 * quality)); i++) {
          ctx.beginPath();
          ctx.arc(0, 0, anomaly.r * (0.55 + i * 0.22), i * 0.8, Math.PI * 1.55 + i * 0.8);
          ctx.strokeStyle = anomaly.kind === "boost" ? "rgba(225,120,255,0.58)" : "rgba(177,0,211,0.52)";
          ctx.lineWidth = 1.4;
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = i === 0 ? 7 : 0;
          ctx.stroke();
        }
        ctx.restore();
      }

      for (const hole of blackHoleState.microHoles) {
        const p = Math.min(1, hole.life / 30) * Math.min(1, (hole.maxLife - hole.life + 18) / 32);
        ctx.save();
        ctx.globalAlpha = p;
        ctx.translate(hole.x, hole.y);
        ctx.rotate(f * 0.05 + hole.spin);
        ctx.fillStyle = "rgba(0,0,0,0.9)";
        ctx.shadowColor = "rgba(177,0,211,0.82)";
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.arc(0, 0, hole.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(225,120,255,0.72)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, hole.r * 1.9, hole.r * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const distToBall = Math.hypot(ballX - cx, ballY - cy);
      const near = Math.max(0, 1 - distToBall / (Math.min(W, H) * 0.23));
      if (near > 0 && !bossModeActive && !preBossActive) {
        ctx.beginPath();
        ctx.arc(ballX, ballY, BALL_R + 13 + near * 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(225,120,255,${0.18 + near * 0.36})`;
        ctx.shadowColor = "rgba(177,0,211,0.85)";
        ctx.shadowBlur = 8 + near * 8;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if ((hr >= 0.5 && blackHoleState.radialGlitchTier < 1) || (hr >= 0.75 && blackHoleState.radialGlitchTier < 2)) {
        blackHoleState.radialGlitchFrames = 28;
        blackHoleState.radialGlitchTier = hr >= 0.75 ? 2 : 1;
        pongAudio.glitch();
      }
      if (hr < 0.45) blackHoleState.radialGlitchTier = 0;
      if (blackHoleState.radialGlitchFrames > 0) {
        const a = blackHoleState.radialGlitchFrames / 28;
        blackHoleState.radialGlitchFrames--;
        const radialRays = Math.max(8, Math.round(18 * quality));
        for (let i = 0; i < radialRays; i++) {
          const ang = (Math.PI * 2 * i) / radialRays + f * 0.018;
          const len = W * (0.08 + Math.random() * 0.34) * a;
          ctx.strokeStyle = i % 2 ? `rgba(177,0,211,${0.18 * a})` : `rgba(225,120,255,${0.15 * a})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * 55, cy + Math.sin(ang) * 55);
          ctx.lineTo(cx + Math.cos(ang) * (55 + len), cy + Math.sin(ang) * (55 + len));
          ctx.stroke();
        }
      }

      if (hr > 0.45) {
        const split = (hr - 0.45) * 6;
        ctx.strokeStyle = `rgba(177,0,211,${0.08 + hr * 0.08})`;
        ctx.strokeRect(10 - split, 10, W - 20, H - 20);
        ctx.strokeStyle = `rgba(225,120,255,${0.05 + hr * 0.05})`;
        ctx.strokeRect(10 + split, 10, W - 20, H - 20);
      }

      if (heat >= HEAT_MAX || preBossActive) {
        const pulse = 0.5 + Math.sin(f * 0.18) * 0.5;
        ctx.strokeStyle = `rgba(255,255,255,${0.15 + pulse * 0.15})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(W, H) * (0.16 + pulse * 0.12), 0, Math.PI * 2);
        ctx.stroke();
      }

      const vignette = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.15, cx, cy, W * 0.72);
      vignette.addColorStop(0, "rgba(0,0,0,0.05)");
      vignette.addColorStop(1, `rgba(0,0,0,${0.36 + hr * 0.18})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
    }

    // The Construct is deliberately visual-only: it never changes the playfield,
    // collision geometry, paddle dimensions, ball state, or camera values.
    const constructState = {
      frame: 0,
      initialized: false,
      glitchFrames: 0,
      glitchX: 0,
      glitchY: 0,
      glitchWidth: 0
    };

    function initConstructArena() {
      constructState.frame = 0;
      constructState.glitchFrames = 0;
      constructState.glitchX = 0;
      constructState.glitchY = 0;
      constructState.glitchWidth = 0;
      constructState.initialized = true;
    }

    function cleanupConstructArena() {
      constructState.initialized = false;
      constructState.glitchFrames = 0;
    }

    function drawConstructBackdrop(hr) {
      if (!constructState.initialized) initConstructArena();
      const W = canvas.width, H = canvas.height;
      const f = ++constructState.frame;
      const quality = getVisualQualityScale();
      const horizon = H * 0.26;
      const cx = W * 0.5;
      // Nothing destabilises at low Heat. Escalation begins just above 20%, then
      // ramps quickly enough to be unmistakable during a sustained rally.
      const corruption = Math.max(0, (hr - 0.20) / 0.80);

      // Polished black simulation floor and deep digital void.
      ctx.fillStyle = "#01050a";
      ctx.fillRect(-60, -60, W + 120, H + 120);
      const atmosphere = ctx.createRadialGradient(cx, horizon, 0, cx, horizon, Math.max(W, H) * 0.76);
      atmosphere.addColorStop(0, `rgba(0,151,210,${0.10 + hr * 0.08})`);
      atmosphere.addColorStop(0.5, "rgba(0,38,62,0.08)");
      atmosphere.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = atmosphere;
      ctx.fillRect(-60, -60, W + 120, H + 120);
      const violetBloom = ctx.createRadialGradient(cx, horizon + H * 0.12, 0, cx, horizon + H * 0.12, W * 0.56);
      violetBloom.addColorStop(0, `rgba(140,72,255,${0.055 + hr * 0.045})`);
      violetBloom.addColorStop(0.55, "rgba(84,34,164,0.018)");
      violetBloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = violetBloom;
      ctx.fillRect(-60, -60, W + 120, H + 120);

      // The Construct's signature: a luminous aperture and mirrored monoliths.
      // These strong silhouettes make the map read differently at a glance, even
      // before Heat introduces any corruption.
      ctx.save();
      const apertureY = horizon - 66;
      ctx.translate(cx, apertureY);
      ctx.rotate(Math.sin(f * 0.004) * 0.025);
      ctx.shadowColor = "rgba(77,238,255,0.88)";
      ctx.shadowBlur = 20;
      ctx.strokeStyle = "rgba(80,237,255,0.48)";
      ctx.lineWidth = 2;
      [56, 37].forEach((radius, ring) => {
        ctx.beginPath();
        for (let p = 0; p <= 6; p++) {
          const a = Math.PI / 3 * p - Math.PI / 6;
          const px = Math.cos(a) * radius;
          const py = Math.sin(a) * radius;
          p ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
        if (!ring) {
          ctx.strokeStyle = "rgba(255,67,183,0.32)";
          ctx.stroke();
          ctx.strokeStyle = "rgba(80,237,255,0.48)";
        }
      });
      ctx.fillStyle = "rgba(220,255,255,0.68)";
      ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();

      ctx.save();
      [[-1, "77,235,255"], [1, "255,69,179"]].forEach(([side, color]) => {
        const x = cx + side * W * 0.33;
        const top = horizon - 112;
        const bottom = horizon + 10;
        ctx.strokeStyle = `rgba(${color},0.28)`;
        ctx.shadowColor = `rgba(${color},0.52)`;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 18, bottom); ctx.lineTo(x - 11, top + 20); ctx.lineTo(x, top);
        ctx.lineTo(x + 11, top + 20); ctx.lineTo(x + 18, bottom); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = `rgba(${color},0.12)`;
        ctx.fill();
        ctx.fillStyle = "rgba(240,255,255,0.72)";
        ctx.fillRect(x - 1, top + 28 + (f * 0.6) % 48, 2, 14);
      });
      ctx.restore();

      const horizonBeam = ctx.createLinearGradient(0, horizon, W, horizon);
      horizonBeam.addColorStop(0, "rgba(77,232,255,0)");
      horizonBeam.addColorStop(0.18, "rgba(77,232,255,0.34)");
      horizonBeam.addColorStop(0.50, "rgba(245,255,255,0.78)");
      horizonBeam.addColorStop(0.82, "rgba(255,68,182,0.32)");
      horizonBeam.addColorStop(1, "rgba(255,68,182,0)");
      ctx.fillStyle = horizonBeam;
      ctx.shadowColor = "rgba(86,236,255,0.72)";
      ctx.shadowBlur = 14;
      ctx.fillRect(0, horizon - 1, W, 3);
      ctx.shadowBlur = 0;

      // Distant architecture stays intentionally dim so the ball and paddles read first.
      ctx.save();
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const architectureColor = i % 4 === 3 ? "255,66,178" : i % 6 === 5 ? "255,74,86" : "83,234,255";
        ctx.strokeStyle = `rgba(${architectureColor},${0.055 + hr * 0.045})`;
        const x = (i + 0.5) * W / 7 + Math.sin(f * 0.006 + i) * 10;
        const y = horizon - 18 - (i % 3) * 18;
        const s = 14 + (i % 4) * 8;
        ctx.strokeRect(x - s, y - s, s * 2, s * 2);
        ctx.beginPath();
        ctx.moveTo(x - s, y - s); ctx.lineTo(x - s * 0.58, y - s * 1.38);
        ctx.lineTo(x + s * 1.42, y - s * 1.38); ctx.lineTo(x + s, y - s);
        ctx.moveTo(x + s, y - s); ctx.lineTo(x + s * 1.42, y - s * 1.38);
        ctx.lineTo(x + s * 1.42, y + s * 0.62); ctx.lineTo(x + s, y + s);
        ctx.stroke();
      }
      // Sparse energy towers and hexagonal frames fade into the void.
      for (let i = 0; i < 5; i++) {
        const x = W * (0.12 + i * 0.19);
        const top = horizon - 52 - (i % 2) * 26;
        ctx.beginPath(); ctx.moveTo(x, horizon + 8); ctx.lineTo(x, top); ctx.stroke();
        ctx.beginPath();
        for (let p = 0; p <= 6; p++) {
          const a = Math.PI / 3 * p + Math.PI / 6;
          const px = x + Math.cos(a) * 11;
          const py = top + Math.sin(a) * 11;
          p ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();

      // Perspective wireframe floor: thin cyan lines with breathing intersections.
      ctx.save();
      ctx.strokeStyle = `rgba(77,235,255,${0.20 + hr * 0.10})`;
      ctx.lineWidth = 1;
      const rays = Math.max(10, Math.round(20 * quality));
      for (let i = 0; i <= rays; i++) {
        const bottomX = W * i / rays;
        ctx.beginPath(); ctx.moveTo(cx + (bottomX - cx) * 0.10, horizon); ctx.lineTo(bottomX, H); ctx.stroke();
      }
      const floorRows = Math.max(7, Math.round(13 * quality));
      for (let row = 0; row < floorRows; row++) {
        const t = row / Math.max(1, floorRows - 1);
        const y = horizon + (H - horizon) * t * t;
        const pulse = 0.14 + Math.abs(Math.sin(f * 0.026 + row * 0.7)) * 0.08 + hr * 0.065;
        ctx.strokeStyle = `rgba(77,235,255,${pulse})`;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // The construct occasionally loses tiny grid fragments; secondary colours
      // make the corruption recognizably Glitch Pong without muddying play.
      if (corruption > 0 && Math.random() < 0.025 + corruption * 0.18) {
        const row = 2 + Math.floor(Math.random() * 10);
        const t = row / 12;
        const y = horizon + (H - horizon) * t * t;
        const x = Math.random() * (W - 80);
        ctx.fillStyle = Math.random() < 0.62 ? "rgba(93,241,255,0.66)" : "rgba(255,70,187,0.54)";
        ctx.fillRect(x, y - 1, 20 + Math.random() * 60, 2);
      }
      ctx.restore();

      // Nearly invisible scanlines keep the void electronic while preserving clarity.
      ctx.fillStyle = `rgba(183,220,255,${0.012 + hr * 0.012})`;
      const scanlineStep = quality < 0.55 ? 13 : quality < 0.85 ? 9 : 7;
      for (let y = 0; y < H; y += scanlineStep) ctx.fillRect(0, y, W, 1);

      // Controlled corruption: starts at medium Heat and becomes increasingly
      // frequent, longer, and more saturated as the simulation destabilises.
      if (constructState.glitchFrames > 0) {
        constructState.glitchFrames--;
        const gy = constructState.glitchY;
        const gx = constructState.glitchX;
        const gw = constructState.glitchWidth;
        // Cyan/magenta/red layers deliberately separate by a few pixels: a fast,
        // rare RGB channel split rather than a persistent noisy filter.
        ctx.fillStyle = `rgba(255,62,86,${0.05 + corruption * 0.15})`;
        ctx.fillRect(gx - 3, gy - 1, gw * 0.72, 2);
        ctx.fillStyle = `rgba(255,70,188,${0.07 + corruption * 0.18})`;
        ctx.fillRect(gx, gy, gw, 2);
        ctx.fillStyle = `rgba(78,241,255,${0.08 + corruption * 0.20})`;
        ctx.fillRect(Math.min(W - gw, gx + 5), gy + 3, gw * 0.55, 1);
        ctx.fillStyle = `rgba(255,255,255,${0.12 + corruption * 0.20})`;
        ctx.fillRect(gx + gw * 0.38, gy - 4, 3, 9);
      } else if (corruption > 0 && Math.random() < 0.008 + corruption * 0.105) {
        constructState.glitchFrames = 2 + Math.floor(corruption * 5);
        constructState.glitchY = horizon + Math.random() * (H - horizon);
        constructState.glitchX = Math.random() * W * 0.78;
        constructState.glitchWidth = 36 + Math.random() * (130 + corruption * 220);
      }
    }

    function drawConstructCenterConduit(hr) {
      const W = canvas.width, H = canvas.height;
      const f = constructState.frame;
      const x = W * 0.5;
      ctx.save();
      ctx.shadowColor = "rgba(82,238,255,0.75)";
      ctx.shadowBlur = 15 + hr * 10;
      ctx.fillStyle = `rgba(75,229,255,${0.13 + hr * 0.10})`;
      ctx.fillRect(x - 4, 0, 8, H);
      for (let y = -22, n = 0; y < H + 24; y += 30, n++) {
        const offset = (f * (0.82 + hr * 0.85)) % 30;
        const py = y + offset;
        const alpha = 0.38 + 0.34 * Math.abs(Math.sin(f * 0.05 + n * 0.55));
        ctx.fillStyle = `rgba(90,242,255,${alpha})`;
        ctx.fillRect(x - 3, py, 6, 17);
        ctx.fillStyle = `rgba(245,255,255,${alpha * 0.95})`;
        ctx.fillRect(x - 1, py + 3, 2, 10);
        if ((n + Math.floor(f / 20)) % 7 === 0) {
          ctx.fillStyle = `rgba(255,69,183,${0.20 + hr * 0.14})`;
          ctx.fillRect(x + 5, py + 7, 8, 2);
        }
      }
      ctx.restore();
    }

    function drawConstructHeatCorruption(hr) {
      const intensity = Math.max(0, (hr - 0.20) / 0.80);
      if (intensity <= 0) return;

      const W = canvas.width, H = canvas.height;
      const quality = getVisualQualityScale();
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      // A coherent scan tear is triggered by the same event that breaks the grid.
      if (constructState.glitchFrames > 0) {
        const y = constructState.glitchY;
        const width = Math.min(W, constructState.glitchWidth * (1.4 + intensity));
        const left = Math.max(0, Math.min(W - width, constructState.glitchX - 12));
        ctx.fillStyle = `rgba(70,236,255,${0.045 + intensity * 0.10})`;
        ctx.fillRect(left + 7, y - 5, width, 11);
        ctx.fillStyle = `rgba(255,58,181,${0.035 + intensity * 0.10})`;
        ctx.fillRect(left, y - 2, width * 0.74, 3);
        ctx.fillStyle = `rgba(255,71,80,${0.03 + intensity * 0.08})`;
        ctx.fillRect(left + 14, y + 4, width * 0.48, 2);
      }

      // Pixel fragments stay sparse at medium Heat, then build into a controlled
      // data storm near maximum Heat without hiding the ball or paddle positions.
      const fragments = Math.max(1, Math.round((1 + intensity * 7) * quality));
      for (let i = 0; i < fragments; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const size = 1 + Math.floor(Math.random() * (1 + intensity * 4));
        const color = i % 3 === 0 ? "255,62,180" : i % 3 === 1 ? "76,238,255" : "255,72,82";
        ctx.fillStyle = `rgba(${color},${0.10 + intensity * 0.19})`;
        ctx.fillRect(x, y, size * 3, size);
      }

      // At high Heat, violet/red edge flicker signals that the arena is failing.
      if (intensity > 0.48) {
        const edgeAlpha = (intensity - 0.48) * 0.15;
        ctx.fillStyle = `rgba(151,70,255,${edgeAlpha})`;
        ctx.fillRect(0, 0, 14, H);
        ctx.fillStyle = `rgba(255,58,86,${edgeAlpha})`;
        ctx.fillRect(W - 14, 0, 14, H);
      }
      ctx.restore();
    }

    function drawConstructOverlay(hr) {
      const W = canvas.width, H = canvas.height;
      const f = constructState.frame;
      ctx.save();

      // Translucent energy barriers; the ball's proximity gives a lightweight impact ripple.
      [[10, 1], [W - 10, -1]].forEach(([x, dir]) => {
        const near = Math.max(0, 1 - Math.abs(ballX - x) / 115);
        const flow = (f * (0.9 + hr) + (dir < 0 ? 28 : 0)) % 26;
        ctx.fillStyle = `rgba(138,68,255,${0.025 + hr * 0.035 + near * 0.04})`;
        ctx.fillRect(x - 10, 0, 20, H);
        ctx.strokeStyle = `rgba(74,228,255,${0.20 + hr * 0.13 + near * 0.24})`;
        ctx.shadowColor = "rgba(58,223,255,0.78)";
        ctx.shadowBlur = 8 + near * 18;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(87,235,255,${0.16 + hr * 0.1})`;
        for (let y = -26 + flow; y < H; y += 26) ctx.fillRect(x - 2, y, 4, 10);
        if (near > 0.12) {
          ctx.beginPath(); ctx.arc(x, ballY, 12 + near * 26, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        }
      });

      // Subtle floor reflections under the readable cyan/magenta paddles and ball.
      ctx.fillStyle = ownerColor("blue", 0.035 + hr * 0.025);
      ctx.fillRect(leftX, leftY + paddleH + 7, paddleW, 25);
      ctx.fillStyle = ownerColor("red", 0.035 + hr * 0.025);
      ctx.fillRect(rightX, rightY + paddleH + 7, paddleW, 25);
      const ballReflection = Math.min(0.15, 0.04 + hr * 0.08);
      ctx.fillStyle = ownerColor(ballOwner, ballReflection);
      ctx.beginPath(); ctx.ellipse(ballX, Math.min(H - 8, ballY + 22), BALL_R * 1.7, BALL_R * 0.45, 0, 0, Math.PI * 2); ctx.fill();

      // Very small data shards are map-specific ball accents, scaled by Heat.
      if (Math.random() < 0.08 + hr * 0.16) {
        const a = Math.random() * Math.PI * 2;
        const d = 13 + Math.random() * (18 + hr * 22);
        ctx.fillStyle = Math.random() < 0.18 ? "rgba(255,76,190,0.58)" : "rgba(105,242,255,0.60)";
        ctx.fillRect(ballX + Math.cos(a) * d, ballY + Math.sin(a) * d, 2, 2);
      }

      // Paddles retain their player colours, with a thin moving energy vein.
      const veinY = (f * (0.7 + hr)) % Math.max(1, paddleH);
      ctx.fillStyle = "rgba(245,255,255,0.62)";
      ctx.fillRect(leftX + 2, leftY + veinY, Math.max(1, paddleW - 4), 1);
      ctx.fillStyle = "rgba(255,235,249,0.62)";
      ctx.fillRect(rightX + 2, rightY + (paddleH - veinY), Math.max(1, paddleW - 4), 1);
      drawConstructHeatCorruption(hr);
      ctx.restore();
    }

    // ── Matrix Mainframe State ──────────────────────────────────────────────
    const matrixState = {
      rain:    [],
      packets: [],
      scan:    { active: false, y: 0, timer: 220 },
      glitchF: 0,
      frame:   0,
      initialized: false
    };

    const MX_CHARS = "ｦｧｨｩｪｫｬｭｮｯｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ01234567890アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン!#$%&<>[]{}|ΔΨΩ∑∫";
    function randMxChar() { return MX_CHARS[Math.floor(Math.random() * MX_CHARS.length)]; }

    function initMatrixArena() {
      if (matrixState.initialized) return;
      const W = canvas.width, H = canvas.height;
      matrixState.rain = [];
      const colW = 14;
      const cols = Math.floor(W / colW);
      for (let i = 0; i < cols; i++) {
        const len = 10 + Math.floor(Math.random() * 22);
        const highlight = Math.random() < 0.14;
        matrixState.rain.push({
          x:        i * colW + colW / 2,
          y:        -Math.random() * H * 2.2,
          spd:      1.4 + Math.random() * 3.6,
          len,
          chars:    Array.from({ length: len + 4 }, randMxChar),
          tick:     0,
          tickRate: 3 + Math.floor(Math.random() * 7),
          op:       highlight ? (0.14 + Math.random() * 0.14) : (0.055 + Math.random() * 0.07),
          highlight
        });
      }
      matrixState.packets = [];
      for (let i = 0; i < 12; i++) {
        const gridStep = Math.floor(H / 10);
        matrixState.packets.push({
          x:    Math.random() * W,
          y:    gridStep * (1 + Math.floor(Math.random() * 8)),
          w:    8 + Math.floor(Math.random() * 20),
          spd:  1.0 + Math.random() * 2.2
        });
      }
      matrixState.scan.timer = 220 + Math.floor(Math.random() * 180);
      matrixState.frame = 0;
      matrixState.initialized = true;
    }

    function cleanupMatrixArena() {
      matrixState.initialized = false;
      matrixState.rain = [];
      matrixState.packets = [];
    }

    function drawMatrixArena(hr) {
      if (!matrixState.initialized) initMatrixArena();
      const W = canvas.width, H = canvas.height;
      const f = ++matrixState.frame;
      const quality = getVisualQualityScale();
      // Rain colour: classic green, or corrupted red during boss alarm
      const isBossAlarm = bossModeActive && bossPhase === BOSS_PHASES.ALARM;
      const isBossActive = bossModeActive || preBossActive;
      const MG = isBossAlarm ? "255,40,40" : "0,255,65"; // Matrix green RGB

      // ── WORLD SPACE: apply same camera transform as drawArenaBase ─────────
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(cameraZoom, cameraZoom);
      ctx.translate(
        -canvas.width / 2 + arenaJitter + cameraDriftX + cameraKickX,
        -canvas.height / 2 + cameraDriftY + cameraKickY
      );

      // Solid black background — completely replaces the teal arena
      ctx.fillStyle = "#000000";
      ctx.fillRect(-20, -20, W + 40, H + 40);

      // ── Matrix green/red atmosphere ───────────────────────────────────────
      const atmosColor = isBossAlarm ? "60,0,0" : "0,35,10";
      const atmosColor2 = isBossAlarm ? "30,0,0" : "0,18,4";
      const atmosGrd = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
      atmosGrd.addColorStop(0, `rgba(${atmosColor},${0.22 + hr * 0.14})`);
      atmosGrd.addColorStop(0.55, `rgba(${atmosColor2},${0.12 + hr * 0.06})`);
      atmosGrd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = atmosGrd;
      ctx.fillRect(-20, -20, W + 40, H + 40);

      // ── Black/Green Grid ─────────────────────────────────────────────────
      const gridCols = 12, gridRows = 8;
      const gcW = W / gridCols, gcH = H / gridRows;
      ctx.strokeStyle = `rgba(${MG},0.055)`;
      ctx.lineWidth = 1;
      for (let c = 1; c < gridCols; c++) {
        const pulse = 0.055 + 0.025 * Math.abs(Math.sin(f * 0.015 + c * 0.4)) * (1 + hr);
        ctx.strokeStyle = `rgba(${MG},${pulse})`;
        ctx.beginPath(); ctx.moveTo(c * gcW, 0); ctx.lineTo(c * gcW, H); ctx.stroke();
      }
      for (let r = 1; r < gridRows; r++) {
        const pulse = 0.055 + 0.025 * Math.abs(Math.sin(f * 0.012 + r * 0.6)) * (1 + hr);
        ctx.strokeStyle = `rgba(${MG},${pulse})`;
        ctx.beginPath(); ctx.moveTo(0, r * gcH); ctx.lineTo(W, r * gcH); ctx.stroke();
      }

      // Occasional bright segment flicker
      if (f % 20 < 3) {
        const fRow = Math.floor(Math.random() * gridRows);
        ctx.strokeStyle = `rgba(${MG},${0.18 + hr * 0.12})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, fRow * gcH); ctx.lineTo(W, fRow * gcH); ctx.stroke();
        ctx.lineWidth = 1;
      }

      // ── Data Packets along grid rows ─────────────────────────────────────
      const visiblePackets = Math.max(4, Math.round(matrixState.packets.length * quality));
      matrixState.packets.forEach((pk, packetIndex) => {
        if (packetIndex >= visiblePackets) return;
        pk.x += pk.spd * (1 + hr * 0.8);
        if (pk.x > W + 30) {
          pk.x = -pk.w;
          pk.y = Math.floor(H / 10) * (1 + Math.floor(Math.random() * 8));
          pk.spd = 1.0 + Math.random() * 2.2;
          pk.w   = 8 + Math.floor(Math.random() * 20);
        }
        ctx.shadowColor = `rgba(${MG},0.8)`;
        ctx.shadowBlur  = 5;
        ctx.fillStyle   = `rgba(${MG},0.5)`;
        ctx.fillRect(pk.x, pk.y - 1, pk.w, 2);
        ctx.fillStyle   = `rgba(255,255,255,0.7)`;
        ctx.fillRect(pk.x + pk.w - 2, pk.y - 1.5, 3, 3);
        ctx.shadowBlur  = 0;
      });

      // ── Animated Center Divider (data bus) ───────────────────────────────
      const cx = W / 2;
      const segH = 16, segGap = 5;
      const segTotal = Math.ceil(H / (segH + segGap));
      const segOffset = (f * 0.55) % (segH + segGap);
      for (let s = -1; s <= segTotal + 1; s++) {
        const sy = s * (segH + segGap) + segOffset;
        if (sy < -segH || sy > H + segH) continue;
        const pulse = 0.3 + 0.35 * Math.abs(Math.sin(f * 0.04 + s * 0.45));
        ctx.fillStyle   = `rgba(${MG},${pulse * (0.45 + hr * 0.15)})`;
        ctx.shadowColor = `rgba(${MG},0.6)`;
        ctx.shadowBlur  = 5;
        ctx.fillRect(cx - 1, sy, 2, segH);
      }
      ctx.shadowBlur = 0;

      // ── Side Rails ───────────────────────────────────────────────────────
      const rOp = 0.07 + hr * 0.06;
      ctx.strokeStyle = `rgba(${MG},${rOp})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(16, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W - 16, 0); ctx.lineTo(W - 16, H); ctx.stroke();
      // Small scrolling binary along sides
      ctx.font = "7px monospace";
      ctx.textAlign = "center";
      const binScroll = (f * 0.3) % 12;
      for (let y = -binScroll; y < H + 14; y += 12) {
        ctx.fillStyle = `rgba(${MG},${0.05 + hr * 0.04})`;
        ctx.fillText(Math.random() > 0.5 ? "1" : "0", 9, y);
        ctx.fillText(Math.random() > 0.5 ? "1" : "0", W - 9, y);
      }

      // ── Corner Scanner Brackets ──────────────────────────────────────────
      const bLen = 20, bOp = 0.09 + 0.03 * Math.sin(f * 0.025);
      ctx.strokeStyle = `rgba(${MG},${bOp})`;
      ctx.lineWidth = 1.5;
      [[4,4,1,1],[W-4,4,-1,1],[4,H-4,1,-1],[W-4,H-4,-1,-1]].forEach(([x,y,sx,sy]) => {
        ctx.beginPath(); ctx.moveTo(x, y + sy * bLen); ctx.lineTo(x, y); ctx.lineTo(x + sx * bLen, y); ctx.stroke();
      });

      // ── Ball + trail + powerup in Matrix world-space ──────────────────────
      // Skip during boss/pre-boss — those phases own ball rendering themselves
      if (!bossModeActive && !preBossActive) {
        // Arena powerup — give it a Matrix-green outer halo, keep type colours
        if (arenaPowerup) {
          const pulse = 1 + Math.sin(arenaPowerup.pulse) * 0.12;
          const r = arenaPowerup.r * pulse;
          const typeColor = arenaPowerup.type === "shield"
            ? "rgba(103,239,255,0.95)"
            : arenaPowerup.type === "power"
              ? "rgba(255,209,102,0.95)"
              : "rgba(255,79,216,0.95)";
          // Outer Matrix-green scan ring
          ctx.beginPath();
          ctx.arc(arenaPowerup.x, arenaPowerup.y, r + 10, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${MG},${0.30 + 0.15 * Math.sin(arenaPowerup.pulse * 1.5)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Soft halo
          ctx.beginPath();
          ctx.arc(arenaPowerup.x, arenaPowerup.y, r + 6, 0, Math.PI * 2);
          ctx.fillStyle = typeColor.replace("0.95", "0.12");
          ctx.fill();
          // Core fill
          ctx.beginPath();
          ctx.arc(arenaPowerup.x, arenaPowerup.y, r, 0, Math.PI * 2);
          ctx.fillStyle = typeColor.replace("0.95", "0.22");
          ctx.shadowColor = typeColor;
          ctx.shadowBlur = 22;
          ctx.fill();
          ctx.shadowBlur = 0;
          // Rim
          ctx.strokeStyle = typeColor;
          ctx.lineWidth = 2;
          ctx.stroke();
          // Letter label
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.font = "bold 14px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            arenaPowerup.type === "shield" ? "S" : arenaPowerup.type === "power" ? "P" : "X",
            arenaPowerup.x, arenaPowerup.y + 1
          );
        }
        // Trail
        const trailScale = Math.min(3, 1 + (colorCharge - 1) * 0.45);
        for (let i = ballTrail.length - 1; i >= 0; i--) {
          const t = ballTrail[i];
          const progress = (ballTrail.length - i) / (ballTrail.length + 1);
          const size = (BALL_R + hr * 0.8) * (1 - progress * 0.25);
          const baseOpacity = (0.05 + progress * 0.15) * (1 + hr * 0.35) * trailScale;
          ctx.beginPath();
          ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
          if (colorCharge >= 2 && ballOwner !== "neutral") {
            const col = ownerRgb(ballOwner);
            ctx.fillStyle   = `rgba(${col},${Math.min(0.9, baseOpacity * 1.4)})`;
            ctx.shadowColor = `rgba(${col},0.4)`;
          } else {
            ctx.fillStyle   = `rgba(255,255,255,${baseOpacity})`;
            ctx.shadowColor = `rgba(255,255,255,${0.3 * (1 - progress)})`;
          }
          ctx.shadowBlur = (14 + hr * 6) * (1 - progress);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        // Decoy balls (split power-up)
        for (let i = 0; i < decoys.length; i++) {
          const decoy = decoys[i];
          const lifeRatio = Math.max(0, decoy.life / decoy.maxLife);
          ctx.beginPath();
          ctx.arc(decoy.x, decoy.y, (8 + hr * 0.6) * (0.92 + lifeRatio * 0.18), 0, Math.PI * 2);
          ctx.fillStyle   = ownerHex(ballOwner);
          ctx.shadowColor = ownerColor(ballOwner, 0.75 + hr * 0.2);
          ctx.shadowBlur  = 22 + hr * 12;
          ctx.fill();
          ctx.shadowBlur  = 0;
        }
        // Ball — keep original cyan/magenta glow so it pops against the green
        const chargeGlow = (colorCharge - 1) * 9;
        const chargeSize = (colorCharge - 1) * 0.5;
        drawColorChargeFX(ballX, ballY);
        ctx.beginPath();
        ctx.arc(ballX, ballY, BALL_R + hr * 1.2 + chargeSize, 0, Math.PI * 2);
        ctx.fillStyle   = ownerHex(ballOwner);
        ctx.shadowColor = ownerColor(ballOwner, 0.75 + hr * 0.2 + (colorCharge - 1) * 0.05);
        ctx.shadowBlur  = 22 + hr * 12 + chargeGlow;
        ctx.fill();
        ctx.shadowBlur  = 0;

        // Drowsy Z particles
        drawDrowsyFX(hr);
      }

      ctx.restore(); // end world space

      // ── Paddles in screen-space ───────────────────────────────────────────
      // Drawing OUTSIDE the camera-transform context means leftX/rightX are
      // always their true pixel positions — camera drift can never push them
      // off-screen toward the goal walls.
      ctx.save();
      // Dash trails (raw game coords match screen coords here)
      for (const trail of leftDashTrail) {
        const da = Math.max(0, trail.life / 16) * (0.18 + hr * 0.14);
        ctx.fillStyle = `rgba(103,239,255,${da})`;
        ctx.shadowColor = `rgba(103,239,255,${da * 1.4})`; ctx.shadowBlur = 16;
        ctx.fillRect(trail.x, trail.y, paddleW, paddleH); ctx.shadowBlur = 0;
      }
      for (const trail of rightDashTrail) {
        const da = Math.max(0, trail.life / 16) * (0.18 + hr * 0.14);
        ctx.fillStyle = `rgba(255,79,216,${da})`;
        ctx.shadowColor = `rgba(255,79,216,${da * 1.4})`; ctx.shadowBlur = 16;
        ctx.fillRect(trail.x, trail.y, paddleW, paddleH); ctx.shadowBlur = 0;
      }
      if (powerState.blue.shieldTimer > 0) {
        ctx.fillStyle = "rgba(103,239,255,0.10)"; ctx.fillRect(0, 0, leftX + paddleW + 4, canvas.height);
        ctx.fillStyle = "rgba(103,239,255,0.22)"; ctx.fillRect(leftX + paddleW, 0, 4, canvas.height);
        ctx.shadowColor = "rgba(103,239,255,0.8)"; ctx.shadowBlur = 18;
        ctx.fillRect(leftX + paddleW, 0, 4, canvas.height); ctx.shadowBlur = 0;
      }
      if (powerState.red.shieldTimer > 0) {
        ctx.fillStyle = "rgba(255,79,216,0.10)"; ctx.fillRect(rightX - 4, 0, canvas.width - rightX + 4, canvas.height);
        ctx.fillStyle = "rgba(255,79,216,0.22)"; ctx.fillRect(rightX - 4, 0, 4, canvas.height);
        ctx.shadowColor = "rgba(255,79,216,0.8)"; ctx.shadowBlur = 18;
        ctx.fillRect(rightX - 4, 0, 4, canvas.height); ctx.shadowBlur = 0;
      }
      drawPaddle(leftX,  leftY,  bluePaddleImage, leftImageReady,  ownerColor("blue"), ownerHex("blue"));
      drawPaddle(rightX, rightY, redPaddleImage,  rightImageReady, ownerColor("red"), ownerHex("red"));
      ctx.restore();

      // ── SCREEN SPACE: Digital Rain ───────────────────────────────────────
      ctx.save();
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      const rainMult = 1 + hr * 2.8;
      const charH = 16;
      const rainStride = quality < 0.55 ? 3 : quality < 0.85 ? 2 : 1;
      const charStride = quality < 0.55 ? 2 : 1;
      matrixState.rain.forEach((col, columnIndex) => {
        if (columnIndex % rainStride !== 0) return;
        col.y += col.spd * rainMult;
        if (col.y - col.len * charH > H) {
          col.y = -charH * 2 - Math.random() * H * 0.6;
          col.spd = 1.4 + Math.random() * 3.6;
          col.len = 10 + Math.floor(Math.random() * 22);
          col.highlight = Math.random() < 0.14;
          col.op = col.highlight ? (0.14 + Math.random() * 0.14) : (0.055 + Math.random() * 0.07);
        }
        if (++col.tick > (col.tickRate || 6)) {
          col.tick = 0;
          col.chars[Math.floor(Math.random() * col.chars.length)] = randMxChar();
        }
        const baseOp = col.op * (1 + hr * 1.0);
        for (let j = 0; j < col.len; j += charStride) {
          const cy = col.y - j * charH;
          if (cy < -charH || cy > H + charH) continue;
          const fade = Math.pow(1 - j / col.len, 0.55);
          if (j === 0) {
            // Head — bright white/green with glow
            ctx.shadowColor = `rgba(${MG},1)`;
            ctx.shadowBlur = quality < 0.55 ? 4 : 10;
            ctx.fillStyle = `rgba(230,255,230,${Math.min(0.98, baseOp * 7)})`;
            ctx.fillText(col.chars[0], col.x, cy);
            ctx.shadowBlur = 0;
          } else if (j <= 2) {
            // Near-head — bright green
            const op = Math.min(0.85, baseOp * fade * 5);
            ctx.fillStyle = `rgba(160,255,160,${op})`;
            ctx.fillText(col.chars[j % col.chars.length], col.x, cy);
          } else {
            // Tail — standard matrix green with highlight boost
            const op = Math.min(0.65, baseOp * fade * (col.highlight ? 2.0 : 1.0));
            ctx.fillStyle = `rgba(${MG},${op})`;
            ctx.fillText(col.chars[j % col.chars.length], col.x, cy);
          }
        }
      });

      // ── Horizontal scan sweep ─────────────────────────────────────────────
      const sc = matrixState.scan;
      if (--sc.timer <= 0 && !sc.active) {
        sc.active = true; sc.y = -10;
        sc.timer = 200 + Math.floor(Math.random() * 280 / (1 + hr));
      }
      if (sc.active) {
        sc.y += 3.5 + hr * 3;
        const grd = ctx.createLinearGradient(0, sc.y - 12, 0, sc.y + 12);
        grd.addColorStop(0, `rgba(${MG},0)`);
        grd.addColorStop(0.5, `rgba(${MG},${0.04 + hr * 0.04})`);
        grd.addColorStop(1, `rgba(${MG},0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, sc.y - 12, W, 24);
        if (sc.y > H + 12) sc.active = false;
      }

      // ── Ambient glitch lines ─────────────────────────────────────────────
      if (matrixState.glitchF > 0) {
        matrixState.glitchF--;
        const gy = Math.floor(Math.random() * H);
        const gw = 30 + Math.floor(Math.random() * 160);
        const gx = Math.floor(Math.random() * (W - gw));
        ctx.fillStyle = `rgba(${MG},${0.04 + hr * 0.04})`;
        ctx.fillRect(gx, gy, gw, 2);
      } else if (Math.random() < 0.005 + hr * 0.008) {
        matrixState.glitchF = 1 + Math.floor(Math.random() * 2);
      }

      // Overall vignette — green normally, deepens to dark red during boss
      const vigColor = isBossAlarm ? "20,0,0" : "0,10,2";
      const vigGrd = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.65);
      vigGrd.addColorStop(0, "rgba(0,0,0,0)");
      vigGrd.addColorStop(1, `rgba(${vigColor},${0.28 + hr * 0.18})`);
      ctx.fillStyle = vigGrd;
      ctx.fillRect(0, 0, W, H);
      // Heat intensity tint
      if (hr > 0.3) {
        ctx.fillStyle = `rgba(${MG},${(hr - 0.3) * 0.06})`;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.restore();
    }
    // called from render() — dispatches to correct arena overlay
    function drawArenaOverlay() {
      if (currentArenaId === "matrix") {
        drawMatrixArena(getHeatRatio());
      } else if (currentArenaId === "construct") {
        drawConstructOverlay(getHeatRatio());
      } else if (currentArenaId === "blackhole") {
        drawBlackHoleNexusOverlay(getHeatRatio());
      }
    }

    // tracks whether paddles were drawn by drawArenaBase this frame
    let showPaddlesThisFrame = true;

    function render() {
      const isMatrix = currentArenaId === "matrix";
      const showGameplayHud = currentScreen === "game" && !isPaused && !gameOver && !progScreen;
      hud.style.display = showGameplayHud ? "block" : "none";
      help.style.display = !isMobileDevice && showGameplayHud ? "block" : "none";
      mobilePauseBtn.style.display = isMobileDevice && showGameplayHud ? "grid" : "none";
      showPaddlesThisFrame = !isMatrix;
      drawArenaBase(0.18, !isMatrix);  // skip paddles in base for Matrix (overlay redraws them)
      drawArenaOverlay();
      if (!isMatrix) drawScreenSpacePaddles();
      drawGlitchWalls();
      drawBossFight();
      let status = twoPlayerMode ? "2P" : "1P";
      if (gameOver) status += " // MATCH OVER";
      else if (bossModeActive) status += ' // <span style="color:#ff5a6e">SYSTEM CORRUPTED</span>';
      else if (roundFrozen && modeSelected) status += " // RELAUNCH";
      const heatDisplay = Math.round(heat);
      const comboDisplay = combo > 1 ? ` // COMBO: <span style="color:#ff8feb">x${combo}</span>` : "";
      const clutchDisplay = clutchMode ? ' // <span style="color:#ff637d">CLUTCH MODE</span>' : "";
      const ownerDisplay = ballOwner === "neutral"
        ? '<span style="color:#f3f6ff">NEUTRAL</span>'
        : `<span style="color:${ownerHex(ballOwner)}">${ballOwner === "blue" ? "BLUE" : "RED"}</span>`;
      const powerupLabel = arenaPowerup ? (arenaPowerup.type === "shield" ? "PHASE SHIELD" : arenaPowerup.type === "power" ? "POWER STRIKE" : "SPLIT BALL") : "NONE";
      const leftFx = `${powerState.blue.shieldTimer > 0 ? 'SHIELD ' : ''}${powerState.blue.powerStrikeReady ? 'STRIKE ' : ''}${powerState.blue.splitReady ? 'SPLIT' : ''}`.trim() || 'NONE';
      const rightFx = `${powerState.red.shieldTimer > 0 ? 'SHIELD ' : ''}${powerState.red.powerStrikeReady ? 'STRIKE ' : ''}${powerState.red.splitReady ? 'SPLIT' : ''}`.trim() || 'NONE';
      const leftDashReady = leftDashCooldown <= 0 ? "READY" : `${Math.ceil(leftDashCooldown / 60 * 10) / 10}s`;
      const rightDashReady = rightDashCooldown <= 0 ? "READY" : `${Math.ceil(rightDashCooldown / 60 * 10) / 10}s`;
      const nexusUi = currentArenaId === "blackhole";
      const leftScoreColor = nexusUi ? "#b100d3" : "#7ef9ff";
      const rightScoreColor = nexusUi ? "#b100d3" : "#ff8fab";
      const heatColor = nexusUi ? "#b100d3" : "#ffd27a";
      const dashText = twoPlayerMode
        ? ` // L-DASH: <span style="color:#7ef9ff">${leftDashReady}</span> // R-DASH: <span style="color:#ff8fab">${rightDashReady}</span>`
        : ` // DASH: <span style="color:#7ef9ff">${leftDashReady}</span>`;
      const slowMoDisplay = finalScoreCinematic ? ' // <span style="color:#ffd27a">FINAL SCORE CAM</span>' : '';
      rallyHeatAudio += (getHeatRatio() - rallyHeatAudio) * 0.08;
      pongAudio.setIntensity(rallyHeatAudio);
      updateHUD(isMobileDevice
        ? `L:<span style="color:#7ef9ff">${leftScore}</span> &nbsp; R:<span style="color:#ff8fab">${rightScore}</span> &nbsp; 🔥${heatDisplay}%${combo > 1 ? ` &nbsp; x${combo}` : ''} &nbsp; DASH:<span style="color:#7ef9ff">${leftDashReady}</span>${clutchMode ? ' &nbsp; <span style="color:#ff637d">CLUTCH</span>' : ''}`
        : `LVL <span style="color:#67efff">${GlitchProgression.level}</span> // LEFT: <span style="color:#7ef9ff">${leftScore}</span> // RIGHT: <span style="color:#ff8fab">${rightScore}</span> // HEAT: <span style="color:#ffd27a">${heatDisplay}%</span> // OWNER: ${ownerDisplay} // ORB: <span style="color:#ffd27a">${powerupLabel}</span>${comboDisplay}${dashText} // L-FX: <span style="color:#67efff">${leftFx}</span> // R-FX: <span style="color:#ff8fab">${rightFx}</span>${clutchDisplay}${slowMoDisplay} // ${status}`);

      if (isMobileDevice) {
        const mobileDash = twoPlayerMode ? `${leftDashReady}/${rightDashReady}` : leftDashReady;
        const mobileStatus = combo > 1 || clutchMode
          ? `<div class="gp-mobile-hud-status">${combo > 1 ? `<span style="color:#ff8feb">COMBO x${combo}</span>` : ""}${combo > 1 && clutchMode ? " // " : ""}${clutchMode ? `<span style="color:#ff637d">CLUTCH MODE</span>` : ""}</div>`
          : "";
        updateHUD(`<div class="gp-mobile-hud-grid"><span>L <b style="color:#7ef9ff">${leftScore}</b></span><span>R <b style="color:#ff8fab">${rightScore}</b></span><span style="color:#ffd27a">HEAT ${heatDisplay}%</span><span>DASH <b style="color:#7ef9ff">${mobileDash}</b></span></div>${mobileStatus}`);
      }

      if (countdownActive && countdownPhaseIndex >= 0 && countdownPhaseIndex < COUNTDOWN_PHASES.length) {
        const phase = COUNTDOWN_PHASES[countdownPhaseIndex];
        const countdownImage = getCountdownImage(phase.key);
        const phaseProgress = Math.max(0, Math.min(1, countdownFrame / phase.duration));
        const alpha = phase.key === "GO" ? 1 - Math.max(0, (phaseProgress - 0.45) / 0.55) : 1 - Math.max(0, (phaseProgress - 0.72) / 0.28);
        const scale = phase.key === "GO" ? (0.84 + phaseProgress * 0.26) : (0.72 + phaseProgress * 0.2);
        const w = Math.min(canvas.width * 0.78, (countdownImage.naturalWidth || 900) * scale);
        const aspect = (countdownImage.naturalWidth && countdownImage.naturalHeight) ? (countdownImage.naturalHeight / countdownImage.naturalWidth) : 0.6;
        const h = w * aspect;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.shadowColor = phase.key === "GO" ? "rgba(255,209,102,0.9)" : "rgba(255,79,216,0.9)";
        ctx.shadowBlur = phase.key === "GO" ? 36 : 24;
        if (countdownImage.complete && countdownImage.naturalWidth) {
          ctx.drawImage(countdownImage, canvas.width / 2 - w / 2, canvas.height / 2 - h / 2, w, h);
        }
        ctx.restore();
      }

      if (finalScoreCinematic) {
        const cinematicColor = finalScoreSide === "LEFT" ? "#67efff" : "#ff8fab";
        ctx.save();
        ctx.fillStyle = finalScoreSide === "LEFT" ? "rgba(103,239,255,0.12)" : "rgba(255,79,216,0.12)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (finalScoreTrailSnapshot.length) {
          finalScoreTrailSnapshot.forEach((trail, index) => {
            const alpha = Math.max(0.08, 0.34 - index * 0.035);
            const size = Math.max(10, 18 - index * 1.1);
            ctx.globalAlpha = alpha;
            ctx.shadowColor = cinematicColor;
            ctx.shadowBlur = 18;
            ctx.fillStyle = cinematicColor;
            ctx.fillRect(trail.x - size / 2, trail.y - size / 2, size, size);
          });
          ctx.globalAlpha = 1;
        }

        if (finalScoreBallSnapshot) {
          ctx.shadowColor = cinematicColor;
          ctx.shadowBlur = 26;
          ctx.fillStyle = cinematicColor;
          ctx.fillRect(finalScoreBallSnapshot.x - 11, finalScoreBallSnapshot.y - 11, 22, 22);
        }

        const flashAlpha = Math.max(0, Math.min(1, finalScoreCinematicTimer / 58));
        ctx.globalAlpha = 0.82;
        ctx.textAlign = "center";
        ctx.shadowColor = cinematicColor;
        ctx.shadowBlur = 24;
        ctx.fillStyle = cinematicColor;
        ctx.font = "bold 44px monospace";
        ctx.fillText("FINAL POINT", canvas.width / 2, canvas.height * 0.26);
        ctx.globalAlpha = 0.35 + flashAlpha * 0.25;
        ctx.font = "bold 18px monospace";
        ctx.fillStyle = "#f4fbff";
        ctx.fillText(`${winner} TAKES THE MATCH`, canvas.width / 2, canvas.height * 0.26 + 34);
        ctx.restore();
      }

      if (gameOver) {
        ctx.save();

        if (progScreen === "matchSummary") {
          // Match summary IS the game-over screen — draw it fullscreen
          ctx.fillStyle = "rgba(0,0,0,0.80)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
          drawMatchSummary();
          drawHeatBar();
        drawXPBar();
          drawXPFloats();
        } else if (progScreen === "levelUp" || progScreen === "perkSelect") {
          // Level-up / perk select on top of a dimmed arena
          ctx.fillStyle = "rgba(0,0,0,0.70)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
          if (progScreen === "levelUp") drawLevelUpScreen();
          else drawPerkSelectScreen();
          drawHeatBar();
        drawXPBar();
          drawXPFloats();
        } else {
          // Normal game-over screen (shown after summary is dismissed)
          ctx.fillStyle = "rgba(0,0,0,0.62)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const winnerColor = winner === "LEFT" ? "#67efff" : "#ff8fab";
          ctx.textAlign = "center";
          ctx.shadowColor = winnerColor;
          ctx.shadowBlur = 28;
          ctx.fillStyle = winnerColor;
          ctx.font = `bold ${isMobileDevice ? 34 : 56}px monospace`;
          ctx.fillText(`${winner} PLAYER WINS`, canvas.width / 2, canvas.height / 2 - 18, canvas.width - 48);
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#f4fbff";
          ctx.font = "bold 22px monospace";
          ctx.fillText(`FIRST TO ${WIN_SCORE}`, canvas.width / 2, canvas.height / 2 + 22);
          ctx.fillStyle = "#ffd27a";
          ctx.font = `bold ${isMobileDevice ? 14 : 18}px monospace`;
          ctx.fillText(isMobileDevice ? "TAP TO RETURN TO MENU" : "PRESS R TO RESTART", canvas.width / 2, canvas.height / 2 + 58);
          ctx.restore();
          drawHeatBar();
        drawXPBar();
        }
      }
    }

    const settingsPanel = document.createElement("div");
    settingsPanel.id = "gp-settings-panel";
    settingsPanel.classList.add("gp-mobile-panel");
    settingsPanel.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "z-index:2147483648",
      "width:min(720px, 88vw)",
      "max-height:calc(100vh - 28px)",
      "box-sizing:border-box",
      "overflow-y:auto",
      "padding:28px 30px",
      "border:1px solid rgba(103,239,255,0.28)",
      "border-radius:24px",
      "background:linear-gradient(180deg, rgba(8,15,28,0.96), rgba(5,9,18,0.96))",
      "box-shadow:0 0 34px rgba(103,239,255,0.12), 0 0 60px rgba(255,79,216,0.08)",
      "color:#eafcff",
      "font:16px/1.55 monospace",
      "pointer-events:auto",
      "display:none"
    ].join(";");
    settingsPanel.innerHTML = `
      <div style="text-align:center;font:bold 24px/1.1 monospace;letter-spacing:.14em;color:#71efff;margin-bottom:14px;text-shadow:0 0 18px rgba(113,239,255,.15);">SETTINGS</div>

      <!-- Tab bar -->
      <div id="gp-tab-bar" style="display:flex;gap:8px;margin-bottom:16px;">
        <button id="gp-tab-controls" type="button" style="flex:1;padding:9px 0;border-radius:10px;border:1px solid rgba(103,239,255,0.5);background:rgba(103,239,255,0.12);color:#71efff;font:bold 12px monospace;letter-spacing:.10em;cursor:pointer;">CONTROLS</button>
        <button id="gp-tab-appearance" type="button" style="flex:1;padding:9px 0;border-radius:10px;border:1px solid rgba(103,239,255,0.18);background:rgba(103,239,255,0.03);color:rgba(113,239,255,0.5);font:bold 12px monospace;letter-spacing:.10em;cursor:pointer;">APPEARANCE</button>
        <button id="gp-tab-howto" type="button" style="flex:1;padding:9px 0;border-radius:10px;border:1px solid rgba(103,239,255,0.18);background:rgba(103,239,255,0.03);color:rgba(113,239,255,0.5);font:bold 12px monospace;letter-spacing:.10em;cursor:pointer;">HOW TO PLAY</button>
        <button id="gp-tab-levels" type="button" style="flex:1;padding:9px 0;border-radius:10px;border:1px solid rgba(103,239,255,0.18);background:rgba(103,239,255,0.03);color:rgba(113,239,255,0.5);font:bold 12px monospace;letter-spacing:.10em;cursor:pointer;">LEVEL SYSTEM</button>
      </div>

      <!-- Controls tab -->
      <div id="gp-pane-controls">
        <div id="gp-controls-body"></div>
        <div style="margin-top:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.10);border-radius:12px;background:rgba(255,255,255,.03);font:12px/1.8 monospace;color:rgba(220,220,220,0.7);">
          <span style="color:#ffd27a;">Esc</span> = Back / Pause &nbsp;·&nbsp;
          <span style="color:#ffd27a;">R</span> = Return to Menu
        </div>
        <div style="margin-top:8px;font:10px monospace;color:rgba(103,239,255,0.35);text-align:center;">Click REBIND then press any key &nbsp;·&nbsp; Esc cancels</div>
      </div>

      <!-- Level System tab -->
      <div id="gp-pane-levels" style="display:none;">
        <div id="gp-level-header" style="margin-bottom:12px;padding:12px 14px;border:1px solid rgba(103,239,255,0.22);border-radius:12px;background:rgba(103,239,255,0.06);">
          <!-- filled by JS -->
        </div>
        <div style="font:bold 10px monospace;color:rgba(103,239,255,0.45);letter-spacing:.10em;margin-bottom:6px;">LEVEL PROGRESSION</div>
        <div id="gp-level-list" style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;padding-right:4px;scrollbar-width:thin;scrollbar-color:rgba(103,239,255,0.3) transparent;">
          <!-- filled by JS -->
        </div>
      </div>

      <!-- Appearance tab -->
      <div id="gp-pane-appearance" style="display:none;">
        <div id="gp-appearance-body"></div>
      </div>

      <!-- How to Play tab -->
      <div id="gp-pane-howto" style="display:none;">
        <div style="padding:11px 13px;margin-bottom:12px;border-left:2px solid #71efff;background:rgba(103,239,255,.05);font:11px/1.65 monospace;color:rgba(232,244,255,.72);">MASTER THE RALLY, MANAGE THE HEAT, AND SURVIVE THE SYSTEM.</div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
          <div style="padding:12px;border:1px solid rgba(103,239,255,.20);border-radius:12px;background:rgba(103,239,255,.035);"><div style="font:bold 11px monospace;letter-spacing:.1em;color:#71efff;">WIN THE MATCH</div><div style="margin-top:6px;font:11px/1.65 monospace;color:rgba(230,241,255,.68);">Send the ball past the other paddle. The first side to <span style="color:#ffd166;">7 points</span> wins.</div></div>
          <div style="padding:12px;border:1px solid rgba(255,79,216,.20);border-radius:12px;background:rgba(255,79,216,.035);"><div style="font:bold 11px monospace;letter-spacing:.1em;color:#ff8fab;">MOVE &amp; DASH</div><div style="margin-top:6px;font:11px/1.65 monospace;color:rgba(230,241,255,.68);">P1 uses <span style="color:#71efff;">W / S</span>; P2 uses <span style="color:#ff8fab;">↑ / ↓</span>. Hold Shift with a direction to Dash. Dashes recharge.</div></div>
          <div style="padding:12px;border:1px solid rgba(255,209,102,.20);border-radius:12px;background:rgba(255,209,102,.035);"><div style="font:bold 11px monospace;letter-spacing:.1em;color:#ffd166;">HEAT &amp; CLUTCH</div><div style="margin-top:6px;font:11px/1.65 monospace;color:rgba(230,241,255,.68);">Long rallies raise Heat and destabilize the arena. At match point, Clutch Mode speeds everything up.</div></div>
          <div style="padding:12px;border:1px solid rgba(177,140,255,.22);border-radius:12px;background:rgba(177,140,255,.035);"><div style="font:bold 11px monospace;letter-spacing:.1em;color:#c7a6ff;">POWER-UPS</div><div style="margin-top:6px;font:11px/1.65 monospace;color:rgba(230,241,255,.68);">Shield protects your goal, Power Strike boosts a return, and Split creates decoy balls. The real ball is random.</div></div>
          <div style="padding:12px;border:1px solid rgba(255,92,112,.24);border-radius:12px;background:rgba(255,92,112,.035);"><div style="font:bold 11px monospace;letter-spacing:.1em;color:#ff9ba8;">THE BOSS</div><div style="margin-top:6px;font:11px/1.65 monospace;color:rgba(230,241,255,.68);">At maximum Heat, the Eye appears <span style="color:#ffd166;">once per match</span>. Return all six fireballs to survive; miss one and the other side gains two points.</div></div>
          <div style="padding:12px;border:1px solid rgba(80,250,123,.20);border-radius:12px;background:rgba(80,250,123,.035);"><div style="font:bold 11px monospace;letter-spacing:.1em;color:#8ff5b1;">MODES &amp; PROGRESS</div><div style="margin-top:6px;font:11px/1.65 monospace;color:rgba(230,241,255,.68);">Play 1P, local 2P, or watch AI vs AI. Player matches earn XP, levels, perks, and Stats; AI vs AI is spectator-only.</div></div>
        </div>
      </div>

      <button type="button" aria-label="Back" style="margin:18px auto 0;display:block;padding:10px 28px;border-radius:12px;border:1px solid rgba(103,239,255,0.28);background:rgba(9,18,34,0.94);color:#eafcff;font:bold 14px monospace;letter-spacing:.12em;cursor:pointer;">BACK</button>
    `;
    const settingsBackBtn = settingsPanel.querySelector("button[aria-label='Back']");

    // Store shell: intentionally lightweight until cosmetic inventory is added.
    const storePanel = document.createElement("div");
    storePanel.id = "gp-store-panel";
    storePanel.classList.add("gp-mobile-panel");
    storePanel.style.cssText = [
      "position:absolute", "left:50%", "top:50%", "transform:translate(-50%,-50%)",
      "z-index:2147483648", "width:min(470px,88vw)", "padding:30px",
      "border:1px solid rgba(255,209,102,.32)", "border-radius:24px",
      "background:linear-gradient(180deg,rgba(18,15,25,.97),rgba(7,9,18,.97))",
      "box-shadow:0 0 38px rgba(255,209,102,.10),0 0 70px rgba(255,79,216,.08)",
      "color:#eafcff", "font:15px/1.55 monospace", "text-align:center",
      "pointer-events:auto", "display:none"
    ].join(";");
    storePanel.innerHTML = `
      <div style="width:58px;height:58px;margin:0 auto 14px;display:grid;place-items:center;border:1px solid rgba(255,209,102,.65);border-radius:16px;background:rgba(255,209,102,.08);box-shadow:0 0 20px rgba(255,209,102,.18);">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ffd166" stroke-width="1.8" aria-hidden="true"><path d="M4 8h16l-1.1 11H5.1L4 8Z"/><path d="M8 8a4 4 0 0 1 8 0"/><path d="M9 13h.01M15 13h.01"/></svg>
      </div>
      <div style="font:bold 24px monospace;letter-spacing:.14em;color:#ffd166;text-shadow:0 0 16px rgba(255,209,102,.22);">STORE</div>
      <div style="margin:14px 0;padding:14px;border:1px dashed rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.025);color:rgba(232,242,255,.68);font-size:12px;line-height:1.75;">
        COSMETIC INVENTORY MODULE<br><span style="color:#ff8fab;">COMING SOON</span><br>
        Paddle skins, ball trails, and arena cosmetics will appear here.
      </div>
      <button type="button" aria-label="Store Back" style="padding:10px 28px;border-radius:12px;border:1px solid rgba(255,209,102,.32);background:rgba(255,209,102,.08);color:#ffe1a0;font:bold 13px monospace;letter-spacing:.1em;cursor:pointer;">BACK</button>`;
    const storeBackBtn = storePanel.querySelector("button[aria-label='Store Back']");

    // Dedicated profile screen — reachable from the main menu beside Store.
    const statsPanel = document.createElement("div");
    statsPanel.id = "gp-stats-panel";
    statsPanel.classList.add("gp-mobile-panel");
    statsPanel.style.cssText = [
      "position:absolute", "left:50%", "top:50%", "transform:translate(-50%,-50%)",
      "z-index:2147483648", "width:min(720px,88vw)", "max-height:calc(100vh - 28px)",
      "box-sizing:border-box", "overflow-y:auto", "padding:28px 30px",
      "border:1px solid rgba(113,239,255,.32)", "border-radius:24px",
      "background:linear-gradient(180deg,rgba(6,17,31,.97),rgba(8,7,20,.97))",
      "box-shadow:0 0 38px rgba(103,239,255,.13),0 0 70px rgba(255,79,216,.09)",
      "color:#eafcff", "font:16px/1.55 monospace", "pointer-events:auto", "display:none"
    ].join(";");
    statsPanel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:3px;color:#71efff;text-shadow:0 0 18px rgba(113,239,255,.18);">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
        <div style="font:bold 24px/1.1 monospace;letter-spacing:.14em;">STATS</div>
      </div>
      <div style="text-align:center;margin:0 0 17px;font:10px monospace;letter-spacing:.12em;color:rgba(154,210,231,.55);">PLAYER PROFILE // PERSISTENT RECORD</div>
      <div id="gp-quick-stats-body"></div>
      <button type="button" aria-label="Stats Back" style="margin:18px auto 0;display:block;padding:10px 28px;border-radius:12px;border:1px solid rgba(103,239,255,0.28);background:rgba(9,18,34,0.94);color:#eafcff;font:bold 14px monospace;letter-spacing:.12em;cursor:pointer;">BACK</button>`;
    const statsBackBtn = statsPanel.querySelector("button[aria-label='Stats Back']");

    // ── Settings tab switching ────────────────────────────────────────────
    const tabControls = settingsPanel.querySelector("#gp-tab-controls");
    const tabAppearance = settingsPanel.querySelector("#gp-tab-appearance");
    const tabHowTo = settingsPanel.querySelector("#gp-tab-howto");
    const tabLevels   = settingsPanel.querySelector("#gp-tab-levels");
    const paneControls = settingsPanel.querySelector("#gp-pane-controls");
    const paneAppearance = settingsPanel.querySelector("#gp-pane-appearance");
    const paneHowTo = settingsPanel.querySelector("#gp-pane-howto");
    const paneLevels   = settingsPanel.querySelector("#gp-pane-levels");

    const activeTabStyle   = "flex:1;padding:9px 0;border-radius:10px;border:1px solid rgba(103,239,255,0.5);background:rgba(103,239,255,0.12);color:#71efff;font:bold 12px monospace;letter-spacing:.10em;cursor:pointer;";
    const inactiveTabStyle = "flex:1;padding:9px 0;border-radius:10px;border:1px solid rgba(103,239,255,0.18);background:rgba(103,239,255,0.03);color:rgba(113,239,255,0.5);font:bold 12px monospace;letter-spacing:.10em;cursor:pointer;";

    function switchSettingsTab(tab) {
      rebindingTarget = null; // cancel any active rebind when switching tabs
      if (tab === "controls") {
        tabControls.style.cssText   = activeTabStyle;
        tabAppearance.style.cssText = inactiveTabStyle;
        tabHowTo.style.cssText      = inactiveTabStyle;
        tabLevels.style.cssText     = inactiveTabStyle;
        paneControls.style.display  = "block";
        paneAppearance.style.display = "none";
        paneHowTo.style.display     = "none";
        paneLevels.style.display    = "none";
        rebuildControlsPane();
      } else if (tab === "levels") {
        tabLevels.style.cssText     = activeTabStyle;
        tabControls.style.cssText   = inactiveTabStyle;
        tabAppearance.style.cssText = inactiveTabStyle;
        tabHowTo.style.cssText      = inactiveTabStyle;
        paneLevels.style.display    = "block";
        paneControls.style.display  = "none";
        paneAppearance.style.display = "none";
        paneHowTo.style.display     = "none";
        buildLevelList();
      } else if (tab === "howto") {
        tabHowTo.style.cssText      = activeTabStyle;
        tabControls.style.cssText   = inactiveTabStyle;
        tabAppearance.style.cssText = inactiveTabStyle;
        tabLevels.style.cssText     = inactiveTabStyle;
        paneHowTo.style.display     = "block";
        paneControls.style.display  = "none";
        paneAppearance.style.display = "none";
        paneLevels.style.display    = "none";
      } else {
        tabAppearance.style.cssText = activeTabStyle;
        tabControls.style.cssText   = inactiveTabStyle;
        tabHowTo.style.cssText      = inactiveTabStyle;
        tabLevels.style.cssText     = inactiveTabStyle;
        paneAppearance.style.display = "block";
        paneControls.style.display  = "none";
        paneHowTo.style.display     = "none";
        paneLevels.style.display    = "none";
        buildAppearancePane();
      }
    }

    tabControls.addEventListener("click", () => switchSettingsTab("controls"));
    tabAppearance.addEventListener("click", () => switchSettingsTab("appearance"));
    tabHowTo.addEventListener("click",      () => switchSettingsTab("howto"));
    tabLevels.addEventListener("click",   () => switchSettingsTab("levels"));

    // ── Rebindable controls pane builder ─────────────────────────────────
    const ACTIONS = [
      { key:"p1Up",   label:"Move Up",        player:1 },
      { key:"p1Down", label:"Move Down",       player:1 },
      { key:"p1Dash", label:"Dash Modifier",   player:1 },
      { key:"p2Up",   label:"Move Up",         player:2 },
      { key:"p2Down", label:"Move Down",       player:2 },
      { key:"p2Dash", label:"Dash Modifier",   player:2 }
    ];

    function rebuildControlsPane() {
      const body = settingsPanel.querySelector("#gp-controls-body");
      if (!body) return;

      if (isMobileDevice) {
        body.innerHTML = `
          <div style="padding:12px;border:1px solid rgba(113,239,255,.22);border-radius:12px;background:rgba(113,239,255,.05);">
            <div style="font:bold 13px monospace;color:#71efff;letter-spacing:.08em;">TOUCH CONTROLS</div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px;font:11px/1.55 monospace;color:rgba(230,241,255,.72);">
              <div style="padding:10px;border-radius:9px;background:rgba(103,239,255,.05);"><span style="color:#71efff;">UPPER HALF</span><br>Move paddle up</div>
              <div style="padding:10px;border-radius:9px;background:rgba(255,143,171,.05);"><span style="color:#ff8fab;">LOWER HALF</span><br>Move paddle down</div>
              <div style="padding:10px;border-radius:9px;background:rgba(255,209,102,.05);"><span style="color:#ffd166;">FAST SWIPE</span><br>Dash in swipe direction</div>
              <div style="padding:10px;border-radius:9px;background:rgba(177,140,255,.05);"><span style="color:#c7a6ff;">PAUSE BUTTON</span><br>Open audio and match controls</div>
            </div>
          </div>
          <div style="margin-top:9px;padding:10px;border:1px solid rgba(255,255,255,.10);border-radius:10px;font:10px/1.55 monospace;color:rgba(225,240,255,.55);">LOCAL 2P: Player 1 uses the left side and Player 2 uses the right side. Keyboard rebinding remains available on desktop.</div>`;
        return;
      }

      const p1 = ACTIONS.filter(a => a.player === 1);
      const p2 = ACTIONS.filter(a => a.player === 2);

      function rowsHtml(actions) {
        return actions.map(a => {
          const isWaiting = rebindingTarget === a.key;
          const lbl = codeToLabel(keyBindings[a.key]);
          const btnStyle = isWaiting
            ? "padding:3px 10px;border-radius:6px;border:1px solid rgba(255,209,102,0.9);background:rgba(255,209,102,0.18);color:#ffd27a;font:bold 11px monospace;cursor:pointer;animation:gpBlink 0.7s infinite;"
            : "padding:3px 10px;border-radius:6px;border:1px solid rgba(103,239,255,0.3);background:rgba(103,239,255,0.07);color:#71efff;font:bold 11px monospace;cursor:pointer;";
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
              <span style="font:12px monospace;color:rgba(220,220,220,0.75);">${a.label}</span>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font:bold 13px monospace;color:#ffd27a;min-width:70px;text-align:right;">${isWaiting ? "PRESS KEY…" : lbl}</span>
                <button data-rebind="${a.key}" style="${btnStyle}">${isWaiting ? "CANCEL" : "REBIND"}</button>
              </div>
            </div>`;
        }).join("");
      }

      body.innerHTML = `
        <style>@keyframes gpBlink{0%,100%{opacity:1}50%{opacity:0.4}}</style>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
          <div style="padding:12px;border:1px solid rgba(113,239,255,.18);border-radius:12px;background:rgba(113,239,255,.05);">
            <div style="font:bold 13px monospace;color:#71efff;margin-bottom:10px;letter-spacing:.08em;">PLAYER 1</div>
            ${rowsHtml(p1)}
          </div>
          <div style="padding:12px;border:1px solid rgba(255,143,171,.18);border-radius:12px;background:rgba(255,143,171,.05);">
            <div style="font:bold 13px monospace;color:#ff8fab;margin-bottom:10px;letter-spacing:.08em;">PLAYER 2</div>
            ${rowsHtml(p2)}
          </div>
        </div>`;

      // Attach rebind button listeners
      body.querySelectorAll("[data-rebind]").forEach(btn => {
        btn.addEventListener("click", () => {
          const action = btn.getAttribute("data-rebind");
          rebindingTarget = rebindingTarget === action ? null : action;
          rebuildControlsPane();
        });
      });
    }

    // ── Level list builder ───────────────────────────────────────────────
    function buildStatsPane(body = statsPanel.querySelector("#gp-quick-stats-body")) {
      if (!body) return;
      const data = GlitchProgression.data;
      const matches = data.matchesPlayed || 0;
      const wins = data.wins || 0;
      const losses = data.losses || 0;
      const winRate = matches ? Math.round(wins / matches * 100) : 0;
      const card = (label, value, color = "#eafcff") => `<div class="gp-stat-card" style="padding:10px;border:1px solid ${color}33;border-radius:10px;background:${color}0d;text-align:center;"><div style="font:9px monospace;letter-spacing:.08em;color:rgba(225,240,255,.48);">${label}</div><div style="margin-top:3px;font:bold 20px monospace;color:${color};">${value}</div></div>`;
      const arenaRecords = ARENA_REGISTRY.map(arena => ({
        arena,
        record: (data.arenaStats || {})[arena.id] || { matches: 0, wins: 0, losses: 0 }
      }));
      const bestArena = arenaRecords.reduce((best, current) => current.record.wins > best.record.wins ? current : best, arenaRecords[0]);
      const toughestArena = arenaRecords.reduce((toughest, current) => current.record.losses > toughest.record.losses ? current : toughest, arenaRecords[0]);
      const arenaRows = arenaRecords.map(({ arena, record }) => {
        const rate = record.matches ? Math.round(record.wins / record.matches * 100) : 0;
        return `<div class="gp-arena-record" style="display:grid;grid-template-columns:1.5fr repeat(4,.7fr);gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);font:11px monospace;"><span style="color:${arena.accent};">${arena.name}</span><span class="gp-mobile-hide" style="color:#d8e9f5;text-align:center;">${record.matches}</span><span style="color:#8ff5b1;text-align:center;">${record.wins}</span><span style="color:#ff9bad;text-align:center;">${record.losses}</span><span class="gp-mobile-hide" style="color:#ffd166;text-align:center;">${rate}%</span></div>`;
      }).join("");
      body.innerHTML = `
        <div style="font:bold 11px monospace;letter-spacing:.11em;color:#71efff;margin-bottom:8px;">PLAYER RECORD</div>
        <div class="gp-stats-grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:15px;">${card("MATCHES", matches, "#71efff")}${card("WINS", wins, "#8ff5b1")}${card("LOSSES", losses, "#ff8fab")}${card("WIN RATE", `${winRate}%`, "#ffd166")}</div>
        <div class="gp-stats-grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:16px;">${card("WIN STREAK", data.currentWinStreak || 0, "#c7a6ff")}${card("BEST STREAK", data.bestWinStreak || 0, "#c7a6ff")}${card("POINTS FOR", data.totalPointsScored || 0, "#71efff")}${card("POINTS AGAINST", data.totalPointsAllowed || 0, "#ff8fab")}</div>
        <div style="font:bold 11px monospace;letter-spacing:.11em;color:#71efff;margin-bottom:7px;">ARENA RECORDS</div>
        <div style="border:1px solid rgba(103,239,255,.18);border-radius:11px;overflow:hidden;background:rgba(255,255,255,.02);">
          <div class="gp-arena-record" style="display:grid;grid-template-columns:1.5fr repeat(4,.7fr);gap:6px;padding:7px 10px;background:rgba(103,239,255,.06);font:bold 9px monospace;color:rgba(190,230,245,.56);"><span>ARENA</span><span class="gp-mobile-hide" style="text-align:center;">MATCH</span><span style="text-align:center;">W</span><span style="text-align:center;">L</span><span class="gp-mobile-hide" style="text-align:center;">RATE</span></div>${arenaRows}
        </div>
        <div class="gp-stat-insights" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;font:10px/1.45 monospace;letter-spacing:.035em;">
          <div style="padding:8px 10px;border-left:2px solid ${bestArena.arena.accent};background:rgba(103,239,255,.045);color:rgba(225,240,255,.72);">BEST ARENA<br><span style="color:${bestArena.arena.accent};">${bestArena.arena.name} // ${bestArena.record.wins} WINS</span></div>
          <div style="padding:8px 10px;border-left:2px solid #ff8fab;background:rgba(255,143,171,.045);color:rgba(225,240,255,.72);">TOUGHEST ARENA<br><span style="color:#ff9bad;">${toughestArena.arena.name} // ${toughestArena.record.losses} LOSSES</span></div>
        </div>
        <div class="gp-stats-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:15px;">${card("PADDLE HITS", data.totalPaddleHits || 0, "#71efff")}${card("LONGEST RALLY", data.longestRally || 0, "#ffd166")}${card("BOSS SURVIVALS", data.bossSurvivals || 0, "#ff8fab")}</div>`;
    }

    function buildAppearancePane() {
      const body = settingsPanel.querySelector("#gp-appearance-body");
      if (!body) return;

      const paletteHtml = (owner, label) => {
        const selected = getPaddleColor(owner).id;
        const reserved = getPaddleColor(owner === "blue" ? "red" : "blue").id;
        return `
          <div style="padding:14px;border:1px solid ${owner === "blue" ? "rgba(103,239,255,.22)" : "rgba(255,143,171,.22)"};border-radius:14px;background:rgba(255,255,255,.025);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <span style="font:bold 13px monospace;letter-spacing:.08em;color:${getPaddleColor(owner).hex};">${label}</span>
              <span style="font:10px monospace;color:rgba(235,245,255,.48);">BALL MATCHES ON HIT</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">
              ${PADDLE_COLOR_OPTIONS.map(color => {
                const isSelected = color.id === selected;
                const isReserved = color.id === reserved;
                return `<button type="button" data-paddle-owner="${owner}" data-paddle-color="${color.id}" ${isReserved ? "disabled" : ""} title="${isReserved ? "Used by the other player" : color.name}" style="padding:9px 5px;border-radius:9px;cursor:${isReserved ? "not-allowed" : "pointer"};opacity:${isReserved ? ".32" : "1"};font:bold 9px/1.3 monospace;letter-spacing:.04em;color:${color.hex};background:${isSelected ? `${color.hex}22` : "rgba(255,255,255,.025)"};border:1px solid ${isSelected ? color.hex : "rgba(255,255,255,.12)"};box-shadow:${isSelected ? `0 0 13px ${color.hex}88` : "none"};">
                  <span style="display:block;width:20px;height:20px;border-radius:50%;margin:0 auto 5px;background:${color.hex};box-shadow:0 0 10px ${color.hex};"></span>${color.name}
                </button>`;
              }).join("")}
            </div>
          </div>`;
      };

      body.innerHTML = `
        <div style="padding:10px 12px;margin-bottom:12px;border-left:2px solid #ffd166;background:rgba(255,209,102,.05);font:11px/1.65 monospace;color:rgba(238,245,255,.70);">
          Choose from the high-contrast neon palette. Your paddle and the ball after your hit always share the selected color. A color in use by the other player is locked.
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
          ${paletteHtml("blue", "PLAYER 1 COLOR")}
          ${paletteHtml("red", "PLAYER 2 COLOR")}
        </div>
        <div style="margin-top:12px;padding:14px;border:1px solid rgba(103,239,255,.20);border-radius:14px;background:rgba(103,239,255,.035);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div>
              <div style="font:bold 12px monospace;letter-spacing:.09em;color:#71efff;">MOBILE PERFORMANCE</div>
              <div style="margin-top:4px;font:10px/1.5 monospace;color:rgba(225,240,255,.55);">AUTO GRAPHICS: <span style="color:#ffd166;">${getVisualQualityLabel()}</span>${isMobileDevice ? ` // ${measuredFps} FPS` : " // MOBILE ONLY"}</div>
            </div>
            <button type="button" data-battery-saver aria-pressed="${batterySaverEnabled}" style="min-width:132px;min-height:44px;padding:8px 12px;border-radius:10px;border:1px solid ${batterySaverEnabled ? "rgba(143,245,177,.72)" : "rgba(255,255,255,.18)"};background:${batterySaverEnabled ? "rgba(143,245,177,.12)" : "rgba(255,255,255,.04)"};color:${batterySaverEnabled ? "#8ff5b1" : "rgba(225,240,255,.62)"};font:bold 10px monospace;letter-spacing:.06em;cursor:pointer;">BATTERY SAVER<br>${batterySaverEnabled ? "ON" : "OFF"}</button>
          </div>
          <div style="margin-top:9px;font:10px/1.55 monospace;color:rgba(225,240,255,.48);">Adaptive graphics lowers particles, rain, vortex detail, bloom, and corruption effects when frame rate drops. Battery Saver keeps the lowest visual-cost profile active.</div>
        </div>`;

      body.querySelectorAll("[data-paddle-color]").forEach(button => {
        button.addEventListener("click", () => {
          setPaddleColor(button.getAttribute("data-paddle-owner"), button.getAttribute("data-paddle-color"));
          buildAppearancePane();
        });
      });
      const batteryButton = body.querySelector("[data-battery-saver]");
      if (batteryButton) {
        batteryButton.addEventListener("click", () => {
          batterySaverEnabled = !batterySaverEnabled;
          if (!batterySaverEnabled && isMobileDevice) adaptiveQualityLevel = 1;
          savePerformanceSettings();
          buildAppearancePane();
        });
      }
    }

    function buildLevelList() {
      const prog = GlitchProgression;
      const curLvl = prog.level;
      const xpToNext = prog.xpToNext();

      // Header — current status
      const headerEl = settingsPanel.querySelector("#gp-level-header");
      const pct = Math.round(prog.xpProgress() * 100);
      const barFill = Math.max(2, pct);
      headerEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
          <span style="font:bold 18px monospace;color:#71efff;">LEVEL ${curLvl}</span>
          <span style="font:11px monospace;color:rgba(103,239,255,0.55);">${prog.xp} / ${xpToNext} XP</span>
        </div>
        <div style="height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${barFill}%;background:linear-gradient(90deg,rgba(103,239,255,0.7),rgba(200,255,255,1));border-radius:3px;box-shadow:0 0 8px rgba(103,239,255,0.6);"></div>
        </div>
        <div style="margin-top:6px;font:10px monospace;color:rgba(103,239,255,0.4);">
          TITLE: <span style="color:rgba(255,209,102,0.85);">${prog.getTitle(curLvl)}</span>
          &nbsp;·&nbsp; PERKS EQUIPPED: <span style="color:rgba(103,239,255,0.85);">${prog.data.equippedPerks.length}</span>
          &nbsp;·&nbsp; XP BONUS: <span style="color:rgba(103,239,255,0.85);">+${Math.round(prog.getPerkStat("xpBonus")*100)}%</span>
        </div>`;

      // Row for each level 1→50
      const listEl = settingsPanel.querySelector("#gp-level-list");
      const MAX = 50;
      const PERK_EVERY = 3;
      const rows = [];

      for (let lvl = 1; lvl <= MAX; lvl++) {
        const isCurrent  = lvl === curLvl;
        const isPast     = lvl < curLvl;
        const isFuture   = lvl > curLvl;
        const hasPerk    = lvl % PERK_EVERY === 0;
        const xpNeeded   = prog.xpForLevel(lvl);
        const title      = prog.getTitle(lvl);

        const borderC = isCurrent ? "rgba(103,239,255,0.6)"
                      : isPast    ? "rgba(103,239,255,0.15)"
                      :             "rgba(255,255,255,0.06)";
        const bgC     = isCurrent ? "rgba(103,239,255,0.10)"
                      : isPast    ? "rgba(103,239,255,0.04)"
                      :             "rgba(0,0,0,0)";
        const lvlColor = isCurrent ? "#71efff"
                       : isPast    ? "rgba(103,239,255,0.5)"
                       :             "rgba(255,255,255,0.25)";
        const textColor = isCurrent ? "rgba(220,255,255,0.9)"
                        : isPast    ? "rgba(160,200,200,0.6)"
                        :             "rgba(120,150,150,0.4)";

        // Rewards for this level
        const rewards = [];
        rewards.push(`<span style="color:rgba(255,209,102,${isPast||isCurrent?0.85:0.35});">${title}</span>`);
        if (hasPerk) {
          rewards.push(`<span style="color:rgba(255,79,216,${isPast||isCurrent?0.9:0.35});">▶ PERK CHOICE</span>`);
        }
        const checkmark = isPast ? `<span style="color:rgba(103,239,255,0.5);margin-right:6px;">✓</span>` : "";

        rows.push(`
          <div style="display:flex;align-items:center;padding:7px 10px;border:1px solid ${borderC};border-radius:8px;background:${bgC};${isCurrent?"box-shadow:0 0 10px rgba(103,239,255,0.1);":""}">
            <div style="width:52px;font:bold 13px monospace;color:${lvlColor};flex-shrink:0;">${checkmark}${isCurrent ? `▶ ${lvl}` : `${lvl}`}</div>
            <div style="flex:1;min-width:0;">
              <div style="font:11px monospace;color:${textColor};">${rewards.join(" &nbsp;·&nbsp; ")}</div>
            </div>
            <div style="font:10px monospace;color:rgba(103,239,255,${isPast||isCurrent?0.35:0.18});flex-shrink:0;margin-left:8px;">${xpNeeded.toLocaleString()} XP</div>
          </div>`);
      }
      listEl.innerHTML = rows.join("");

      // Scroll current level into view
      const currentRow = listEl.children[curLvl - 1];
      if (currentRow) currentRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    const pauseMenu = document.createElement("div");
    pauseMenu.id = "gp-pause-menu";
    pauseMenu.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "z-index:2147483649",
      "width:min(980px, 96vw)",
      "aspect-ratio:16 / 9",
      "background:rgba(0,0,0,.92)",
      "pointer-events:auto",
      "overflow:hidden",
      "display:none"
    ].join(";");

    const pauseResumeBtn = document.createElement("button");
    pauseResumeBtn.type = "button";
    pauseResumeBtn.setAttribute("aria-label", "Resume");
    pauseResumeBtn.style.cssText = [
      "position:absolute","left:36.15%","top:55.37%","width:27.71%","height:15.28%",
      "background:transparent","border:none","cursor:pointer","pointer-events:auto"
    ].join(";");

    const pauseQuitBtn = document.createElement("button");
    pauseQuitBtn.type = "button";
    pauseQuitBtn.setAttribute("aria-label", "Quit");
    pauseQuitBtn.style.cssText = [
      "position:absolute","left:36.15%","top:76.02%","width:27.71%","height:15.28%",
      "background:transparent","border:none","cursor:pointer","pointer-events:auto"
    ].join(";");

    const pauseMusicBtn = document.createElement("button");
    pauseMusicBtn.type = "button";
    pauseMusicBtn.setAttribute("aria-label", "Toggle Music");
    pauseMusicBtn.style.cssText = [
      "position:absolute","left:7.0%","top:72.5%","width:7.5%","height:11.5%",
      "background:transparent","border:none","cursor:pointer","pointer-events:auto"
    ].join(";");

    const pauseSfxBtn = document.createElement("button");
    pauseSfxBtn.type = "button";
    pauseSfxBtn.setAttribute("aria-label", "Toggle Sound Effects");
    pauseSfxBtn.style.cssText = [
      "position:absolute","left:15.0%","top:72.5%","width:8.5%","height:11.5%",
      "background:transparent","border:none","cursor:pointer","pointer-events:auto"
    ].join(";");

    const pauseMusicState = document.createElement("div");
    pauseMusicState.style.cssText = "position:absolute;left:7.2%;top:85.8%;width:7%;text-align:center;font:bold 14px monospace;color:#eafcff;text-shadow:0 0 10px rgba(113,239,255,.35);pointer-events:none;";
    const pauseSfxState = document.createElement("div");
    pauseSfxState.style.cssText = "position:absolute;left:15.5%;top:85.8%;width:8%;text-align:center;font:bold 14px monospace;color:#eafcff;text-shadow:0 0 10px rgba(255,143,171,.35);pointer-events:none;";

    pauseMenu.appendChild(pauseResumeBtn);
    pauseMenu.appendChild(pauseQuitBtn);
    pauseMenu.appendChild(pauseMusicBtn);
    pauseMenu.appendChild(pauseSfxBtn);
    pauseMenu.appendChild(pauseMusicState);
    pauseMenu.appendChild(pauseSfxState);
    overlay.appendChild(pauseMenu);
    pauseMenu.style.display = "none";
    let pauseAssetLoaded = false;

    function refreshPauseAudioIndicators() {
      pauseMusicState.textContent = pongAudio.isMusicEnabled() ? "ON" : "OFF";
      pauseSfxState.textContent = pongAudio.isSfxEnabled() ? "ON" : "OFF";
      pauseMusicState.style.opacity = pongAudio.isMusicEnabled() ? "1" : "0.62";
      pauseSfxState.style.opacity = pongAudio.isSfxEnabled() ? "1" : "0.62";
    }

    function showPauseMenu() {
      if (currentScreen !== "game" || gameOver) return;
      if (!pauseAssetLoaded) {
        pauseAssetLoaded = true;
        pauseMenu.style.background = "url('" + PAUSE_MENU_SRC + "') center/100% 100% no-repeat";
      }
      isPaused = true;
      refreshPauseAudioIndicators();
      syncUiForScreen();
    }

    function hidePauseMenu() {
      if (currentScreen === "game") {
        isPaused = false;
        pongAudio.resumeFromVisibility();
        syncUiForScreen();
      }
    }

    const mobilePauseBtn = document.createElement("button");
    mobilePauseBtn.type = "button";
    mobilePauseBtn.setAttribute("aria-label", "Pause game");
    mobilePauseBtn.textContent = "Ⅱ";
    mobilePauseBtn.style.cssText = [
      "position:absolute",
      "top:max(10px, env(safe-area-inset-top))",
      "right:max(10px, env(safe-area-inset-right))",
      "z-index:9000",
      "width:46px",
      "height:46px",
      "display:none",
      "place-items:center",
      "border:1px solid rgba(113,239,255,.52)",
      "border-radius:12px",
      "background:rgba(5,12,24,.82)",
      "box-shadow:0 0 18px rgba(113,239,255,.16)",
      "color:#71efff",
      "font:bold 20px monospace",
      "pointer-events:auto",
      "touch-action:manipulation"
    ].join(";");
    mobilePauseBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      pongAudio.primeFromGesture();
      showPauseMenu();
    });
    overlay.appendChild(mobilePauseBtn);

    let pausedByVisibility = false;
    addListener(document, "visibilitychange", () => {
      if (document.hidden) {
        pongAudio.suspendForVisibility();
        if (onlineState.active) onlineSendInput("stop");
        if (currentScreen === "game" && !gameOver && !isPaused && !onlineState.active) {
          pausedByVisibility = true;
          showPauseMenu();
        }
      } else if (pausedByVisibility) {
        // Keep the game safely paused. The visible Resume button supplies the
        // user gesture mobile browsers require before audio can continue.
        pausedByVisibility = false;
        syncUiForScreen();
      }
    }, true);

    const mainMenu = document.createElement("div");
    mainMenu.id = "gp-main-menu";
    mainMenu.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "z-index:2147483647",
      "width:min(980px, 96vw)",
      "height:min(calc(96vw * 9 / 16), calc(980px * 9 / 16), 86vh)",
      "background:transparent",
      "pointer-events:auto",
      "overflow:visible",
      "display:none"
    ].join(";");

    const modeMenu = document.createElement("div");
    modeMenu.id = "gp-mode-menu";
    modeMenu.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "z-index:2147483647",
      "width:min(980px, 96vw)",
      "height:min(calc(96vw * 9 / 16), calc(980px * 9 / 16), 86vh)",
      "background:url('" + PONG_MENU_SRC + "') center/100% 100% no-repeat",
      
      "pointer-events:auto",
      "overflow:hidden",
      "display:none"
    ].join(";");

    const glitchLayer = document.createElement("div");
    glitchLayer.style.cssText = [
      "position:absolute",
      "inset:0",
      "pointer-events:none",
      "mix-blend-mode:screen"
    ].join(";");
    glitchLayer.innerHTML = '<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 4px);opacity:.28;"></div>';

    const mainMenuImg = document.createElement("img");
    mainMenuImg.src = MAIN_MENU_SRC;
    mainMenuImg.alt = "Glitch Pong Main Menu";
    mainMenuImg.draggable = false;
    mainMenuImg.style.cssText = [
      "position:absolute",
      "inset:0",
      "width:100%",
      "height:100%",
      "object-fit:fill",
      "pointer-events:none",
      "user-select:none",
      "mix-blend-mode:screen",
      "z-index:0"
    ].join(";");

    const modeMenuImg = document.createElement("img");
    modeMenuImg.src = PONG_MENU_SRC;
    modeMenuImg.alt = "Glitch Pong Mode Menu";
    modeMenuImg.draggable = false;
    modeMenuImg.style.cssText = [
      "position:absolute",
      "inset:0",
      "width:100%",
      "height:100%",
      "object-fit:fill",
      "pointer-events:none",
      "user-select:none",
      "z-index:0"
    ].join(";");

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.setAttribute("aria-label", "Play");
    playBtn.style.cssText = [
      "position:absolute",
      "left:36.2%",
      "top:60.4%",
      "width:27.8%",
      "height:12.2%",
      "background:transparent",
      "border:none",
      "cursor:pointer",
      "pointer-events:auto"
    ].join(";");

    const settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.setAttribute("aria-label", "Settings");
    settingsBtn.style.cssText = [
      "position:absolute",
      "left:36.2%",
      "top:80.1%",
      "width:27.8%",
      "height:12.2%",
      "background:transparent",
      "border:none",
      "cursor:pointer",
      "pointer-events:auto"
    ].join(";");

    const storeBtn = document.createElement("button");
    storeBtn.id = "gp-store-action";
    storeBtn.classList.add("gp-corner-action");
    storeBtn.type = "button";
    storeBtn.setAttribute("aria-label", "Store");
    storeBtn.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8h16l-1.1 11H5.1L4 8Z"/><path d="M8 8a4 4 0 0 1 8 0"/></svg><span>STORE</span>';
    storeBtn.style.cssText = [
      "position:absolute", "right:3.2%", "top:4.2%", "z-index:4",
      "display:flex", "align-items:center", "gap:7px", "padding:9px 12px",
      "border:1px solid rgba(255,209,102,.52)", "border-radius:10px",
      "background:rgba(9,14,26,.84)", "color:#ffd166",
      "font:bold 11px monospace", "letter-spacing:.10em", "cursor:pointer",
      "box-shadow:0 0 14px rgba(255,209,102,.12)", "pointer-events:auto"
    ].join(";");

    const statsBtn = document.createElement("button");
    statsBtn.id = "gp-stats-action";
    statsBtn.classList.add("gp-corner-action");
    statsBtn.type = "button";
    statsBtn.setAttribute("aria-label", "Stats");
    statsBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg><span>STATS</span>';
    statsBtn.style.cssText = [
      "position:absolute", "right:12.2%", "top:4.2%", "z-index:4",
      "display:flex", "align-items:center", "gap:7px", "padding:9px 12px",
      "border:1px solid rgba(113,239,255,.52)", "border-radius:10px",
      "background:rgba(9,14,26,.84)", "color:#71efff",
      "font:bold 11px monospace", "letter-spacing:.10em", "cursor:pointer",
      "box-shadow:0 0 14px rgba(103,239,255,.12)", "pointer-events:auto"
    ].join(";");

    mainMenuImg.style.zIndex = "1";
    playBtn.style.zIndex = "3";
    settingsBtn.style.zIndex = "3";
    mainMenu.appendChild(mainMenuImg);
    mainMenu.appendChild(glitchLayer);
    mainMenu.appendChild(playBtn);
    mainMenu.appendChild(settingsBtn);
    mainMenu.appendChild(statsBtn);
    mainMenu.appendChild(storeBtn);
    overlay.appendChild(mainMenu);
    overlay.appendChild(settingsPanel);
    overlay.appendChild(storePanel);
    overlay.appendChild(statsPanel);

    const multiplayerPanel = document.createElement("div");
    const joinPanel = document.createElement("div");
    const onlineLobbyPanel = document.createElement("div");
    multiplayerPanel.id = "gp-multiplayer-panel";
    joinPanel.id = "gp-join-panel";
    onlineLobbyPanel.id = "gp-online-lobby-panel";
    [multiplayerPanel, joinPanel, onlineLobbyPanel].forEach(panel => panel.classList.add("gp-mobile-panel", "gp-online-panel"));
    const onlinePanelStyle = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483648;width:min(530px,90vw);padding:28px;border:1px solid rgba(103,239,255,.30);border-radius:24px;background:linear-gradient(180deg,rgba(5,13,24,.98),rgba(8,5,18,.98));box-shadow:0 0 42px rgba(103,239,255,.13),0 0 80px rgba(255,79,216,.09);color:#eafcff;font:14px/1.5 monospace;pointer-events:auto;display:none;";
    [multiplayerPanel, joinPanel, onlineLobbyPanel].forEach(panel => { panel.style.cssText = onlinePanelStyle; overlay.appendChild(panel); });

    multiplayerPanel.innerHTML = `
      <div style="text-align:center;font:bold 25px monospace;letter-spacing:.14em;color:#71efff;text-shadow:0 0 18px rgba(113,239,255,.24);">PLAYER 2</div>
      <div style="text-align:center;margin:5px 0 20px;font:11px monospace;color:#8aa9bd;letter-spacing:.08em;">MULTIPLAYER PROTOCOL</div>
      <label style="display:block;font:10px monospace;color:#8aa9bd;margin-bottom:6px;">HOST NICKNAME</label>
      <input id="gp-host-name" maxlength="20" value="Host" style="width:100%;padding:11px 12px;margin-bottom:14px;border:1px solid rgba(103,239,255,.26);border-radius:9px;background:#070c17;color:#eafcff;font:14px monospace;outline:none;" />
      <div class="gp-online-actions" style="display:grid;gap:10px;">
        <button data-online-action="local" style="padding:13px;border:1px solid rgba(255,209,102,.42);border-radius:10px;background:rgba(255,209,102,.07);color:#ffe1a0;font:bold 14px monospace;cursor:pointer;">LOCAL GAME <span style="font-size:10px;color:#bda96c;">// ${isMobileDevice ? "SHARED SCREEN" : "SHARED KEYBOARD"}</span></button>
        <button data-online-action="host" style="padding:13px;border:1px solid rgba(103,239,255,.42);border-radius:10px;background:rgba(103,239,255,.08);color:#8ff5ff;font:bold 14px monospace;cursor:pointer;">HOST A GAME <span style="font-size:10px;color:#6caab0;">// CREATE JOIN CODE</span></button>
        <button data-online-action="join" style="padding:13px;border:1px solid rgba(255,79,216,.42);border-radius:10px;background:rgba(255,79,216,.08);color:#ff9de3;font:bold 14px monospace;cursor:pointer;">JOIN GAME <span style="font-size:10px;color:#b86d9f;">// ENTER CODE</span></button>
        <button data-online-action="resume" style="padding:10px;border:1px solid rgba(177,140,255,.35);border-radius:10px;background:rgba(177,140,255,.06);color:#cfb9ff;font:bold 11px monospace;cursor:pointer;">RESUME LAST SESSION</button>
        <button data-online-action="back" style="padding:10px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:rgba(255,255,255,.03);color:#9ab2c4;font:bold 12px monospace;cursor:pointer;">← BACK</button>
      </div>
      <div id="gp-online-error" style="min-height:18px;margin-top:12px;text-align:center;color:#ff8fab;font:11px monospace;"></div>`;

    joinPanel.innerHTML = `
      <div style="text-align:center;font:bold 24px monospace;letter-spacing:.14em;color:#ff8fab;text-shadow:0 0 18px rgba(255,79,216,.22);">JOIN GAME</div>
      <div style="margin:16px 0 8px;font:10px monospace;color:#8aa9bd;">6-DIGIT JOIN CODE</div>
      <input id="gp-join-code" inputmode="numeric" maxlength="6" placeholder="000000" style="width:100%;padding:13px;text-align:center;letter-spacing:.24em;border:1px solid rgba(255,79,216,.4);border-radius:10px;background:#080912;color:#fff;font:bold 22px monospace;outline:none;" />
      <div style="margin:14px 0 8px;font:10px monospace;color:#8aa9bd;">NICKNAME</div>
      <input id="gp-join-name" maxlength="20" value="Player" style="width:100%;padding:11px 12px;border:1px solid rgba(103,239,255,.26);border-radius:9px;background:#070c17;color:#eafcff;font:14px monospace;outline:none;" />
      <div class="gp-online-button-row" style="display:flex;gap:10px;margin-top:18px;"><button data-join-submit style="flex:1;padding:12px;border:1px solid rgba(255,79,216,.45);border-radius:10px;background:rgba(255,79,216,.10);color:#ffb1e8;font:bold 13px monospace;cursor:pointer;">CONNECT</button><button data-join-back style="padding:12px 18px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:rgba(255,255,255,.03);color:#9ab2c4;font:bold 12px monospace;cursor:pointer;">BACK</button></div>
      <div id="gp-join-error" style="min-height:18px;margin-top:12px;text-align:center;color:#ff8fab;font:11px monospace;"></div>`;

    onlineLobbyPanel.innerHTML = `<div id="gp-lobby-content"></div>`;

    function showOnlineError(message) {
      const text = String(message || "");
      [multiplayerPanel.querySelector("#gp-online-error"), joinPanel.querySelector("#gp-join-error")].forEach(node => { if (node) node.textContent = text; });
      const status = onlineLobbyPanel.querySelector("#gp-lobby-status"); if (status) status.textContent = text;
    }

    function refreshOnlineLobby(lobby) {
      if (!lobby) return;
      const host = onlineState.session && onlineState.session.side === "left";
      const hasOpponent = lobby.players.length === 2 && lobby.players.every(player => player.connected);
      onlineLobbyPanel.querySelector("#gp-lobby-content").innerHTML = `
        <div style="text-align:center;font:bold 23px monospace;letter-spacing:.12em;color:#71efff;">ONLINE LOBBY</div>
        <div style="text-align:center;margin:6px 0;font:10px monospace;color:#8aa9bd;">${lobby.joinLocked ? "LOBBY LOCKED" : "WAITING FOR OPPONENT"}</div>
        <div style="margin:18px auto;padding:12px;border:1px solid rgba(255,209,102,.52);border-radius:12px;background:rgba(255,209,102,.07);text-align:center;">
          <div style="font:10px monospace;color:#d4b96d;letter-spacing:.12em;">JOIN CODE</div><div style="font:bold 34px monospace;letter-spacing:.20em;color:#ffe39a;text-shadow:0 0 18px rgba(255,209,102,.45);">${lobby.code}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">${["left","right"].map(side => { const player = lobby.players.find(item => item.side === side); const color = side === "left" ? "#71efff" : "#ff8fab"; return `<div style="padding:12px;border:1px solid ${color}55;border-radius:11px;background:${color}12;text-align:center;"><div style="font:10px monospace;color:${color};">${side.toUpperCase()} PLAYER</div><div style="margin-top:5px;font:bold 14px monospace;color:#eafcff;">${player ? player.nickname : "WAITING..."}</div><div style="margin-top:3px;font:9px monospace;color:${player && player.connected ? "#8ff5b1" : "#ffb0ba"};">${player && player.connected ? "CONNECTED" : "OFFLINE"}</div></div>`; }).join("")}</div>
        <div id="gp-lobby-status" style="min-height:18px;margin:13px 0 4px;text-align:center;color:#ffb1c5;font:10px monospace;">${hasOpponent ? "OPPONENT CONNECTED // HOST MAY START" : "WAITING FOR OPPONENT..."}</div>
        <div class="gp-online-button-row" style="display:flex;gap:9px;margin-top:10px;">${host ? `<button data-lobby-start ${hasOpponent ? "" : "disabled"} style="flex:1;padding:12px;border:1px solid rgba(103,239,255,.50);border-radius:10px;background:rgba(103,239,255,.10);color:#8ff5ff;font:bold 12px monospace;cursor:${hasOpponent ? "pointer" : "not-allowed"};opacity:${hasOpponent ? 1 : .4};">START MATCH</button><button data-lobby-lock style="padding:12px;border:1px solid rgba(255,209,102,.42);border-radius:10px;background:rgba(255,209,102,.07);color:#ffe1a0;font:bold 11px monospace;cursor:pointer;">LOCK</button>` : ""}<button data-lobby-back style="padding:12px 17px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:rgba(255,255,255,.03);color:#9ab2c4;font:bold 11px monospace;cursor:pointer;">BACK</button></div>`;
      const start = onlineLobbyPanel.querySelector("[data-lobby-start]"); if (start) start.addEventListener("click", () => onlineState.socket.emit("host:start"));
      const lock = onlineLobbyPanel.querySelector("[data-lobby-lock]"); if (lock) lock.addEventListener("click", () => onlineState.socket.emit("host:lock"));
      onlineLobbyPanel.querySelector("[data-lobby-back]").addEventListener("click", () => { disconnectOnline(); showModeMenu(); });
    }

    function showOnlineLobby(lobby) { currentScreen = "online-lobby"; refreshOnlineLobby(lobby); syncUiForScreen(); }

    multiplayerPanel.querySelectorAll("[data-online-action]").forEach(button => button.addEventListener("click", async () => {
      const action = button.getAttribute("data-online-action");
      if (action === "local") { pendingTwoPlayer = true; showArenaMenu(); return; }
      if (action === "join") { currentScreen = "online-join"; syncUiForScreen(); return; }
      if (action === "back") { showModeMenu(); return; }
      try {
        if (action === "resume") {
          const saved = JSON.parse(localStorage.getItem("glitchPongResume") || "null");
          if (!saved) throw new Error("No resumable session found on this device.");
          showOnlineError("RESTORING SESSION...");
          const response = await onlineApi("/api/rejoin", saved); connectOnline(response); showOnlineLobby(response.lobbyState); return;
        }
        showOnlineError("CREATING LOBBY..."); const response = await onlineApi("/api/sessions", { nickname: multiplayerPanel.querySelector("#gp-host-name").value }); connectOnline(response); showOnlineLobby(response.lobbyState);
      } catch (error) { showOnlineError(error.message); }
    }));
    joinPanel.querySelector("[data-join-back]").addEventListener("click", () => { currentScreen = "multiplayer"; syncUiForScreen(); });
    joinPanel.querySelector("[data-join-submit]").addEventListener("click", async () => {
      try { const response = await onlineApi("/api/join", { code: joinPanel.querySelector("#gp-join-code").value.trim(), nickname: joinPanel.querySelector("#gp-join-name").value }); connectOnline(response); showOnlineLobby(response.lobbyState); } catch (error) { showOnlineError(error.message); }
    });

    // ── DIFFICULTY PANEL ────────────────────────────────────────────────────
    const difficultyPanel = document.createElement("div");
    difficultyPanel.id = "gp-difficulty-panel";
    difficultyPanel.classList.add("gp-mobile-panel");
    difficultyPanel.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "z-index:2147483648",
      "width:min(760px,94vw)",
      "max-height:calc(100vh - 28px)",
      "box-sizing:border-box",
      "overflow-y:auto",
      "padding:28px 26px 24px",
      "border:1px solid rgba(103,239,255,0.28)",
      "border-radius:24px",
      "background:linear-gradient(180deg,rgba(8,15,28,0.97),rgba(5,9,18,0.97))",
      "box-shadow:0 0 40px rgba(103,239,255,0.13),0 0 70px rgba(255,79,216,0.08)",
      "color:#eafcff",
      "font:15px/1.5 monospace",
      "pointer-events:auto",
      "display:none"
    ].join(";");

    difficultyPanel.innerHTML = `
      <div class="gp-difficulty-title" style="text-align:center;font:bold 26px/1.1 monospace;letter-spacing:.16em;color:#71efff;margin-bottom:6px;text-shadow:0 0 20px rgba(113,239,255,.2);">SELECT DIFFICULTY</div>
      <div id="gp-difficulty-mode-label" style="text-align:center;font:12px monospace;color:#5a7a8a;letter-spacing:.1em;margin-bottom:22px;">1P VS AI</div>
      <div class="gp-difficulty-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px;">

        <button type="button" data-diff="easy" style="
          background:rgba(60,220,120,0.07);
          border:1px solid rgba(60,220,120,0.35);
          border-radius:16px;
          padding:18px 10px 16px;
          cursor:pointer;
          color:#eafcff;
          font:14px monospace;
          text-align:center;
          transition:background .15s,box-shadow .15s;
          pointer-events:auto;
        ">
          <div style="font:bold 22px/1 monospace;letter-spacing:.1em;color:#3ddc84;margin-bottom:10px;text-shadow:0 0 14px rgba(61,220,132,.3);">EASY</div>
          <div style="font-size:11px;line-height:1.6;color:#8fbfa0;">
            Slow AI tracking<br>
            No AI dashing<br>
            AI makes mistakes
          </div>
        </button>

        <button type="button" data-diff="medium" style="
          background:rgba(255,209,102,0.07);
          border:1px solid rgba(255,209,102,0.38);
          border-radius:16px;
          padding:18px 10px 16px;
          cursor:pointer;
          color:#eafcff;
          font:14px monospace;
          text-align:center;
          transition:background .15s,box-shadow .15s;
          pointer-events:auto;
        ">
          <div style="font:bold 22px/1 monospace;letter-spacing:.1em;color:#ffd166;margin-bottom:10px;text-shadow:0 0 14px rgba(255,209,102,.3);">MEDIUM</div>
          <div style="font-size:11px;line-height:1.6;color:#b8a87a;">
            Moderate reactions<br>
            Rare AI dashing<br>
            Occasional misreads
          </div>
        </button>

        <button type="button" data-diff="hard" style="
          background:rgba(255,79,137,0.07);
          border:1px solid rgba(255,79,137,0.35);
          border-radius:16px;
          padding:18px 10px 16px;
          cursor:pointer;
          color:#eafcff;
          font:14px monospace;
          text-align:center;
          transition:background .15s,box-shadow .15s;
          pointer-events:auto;
        ">
          <div style="font:bold 22px/1 monospace;letter-spacing:.1em;color:#ff4f89;margin-bottom:10px;text-shadow:0 0 14px rgba(255,79,137,.3);">HARD</div>
          <div style="font-size:11px;line-height:1.6;color:#bf8898;">
            Fast AI tracking<br>
            Full AI dashing<br>
            Near-perfect reads
          </div>
        </button>

      </div>
      <div class="gp-ai-toggle-row" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:-10px;margin-bottom:18px;">
        <button type="button" data-ai-vs-ai aria-pressed="false" style="grid-column:1;padding:10px 12px;border:1px solid rgba(113,239,255,.34);border-radius:12px;background:rgba(103,239,255,.055);color:#a8f5ff;font:11px/1.35 monospace;letter-spacing:.06em;cursor:pointer;pointer-events:auto;transition:background .15s,box-shadow .15s,border-color .15s;">
          <span style="display:block;font:bold 12px monospace;letter-spacing:.1em;">AI VS AI</span>
          <span data-ai-vs-ai-status style="display:block;margin-top:3px;color:#668e9f;font-size:9px;">OFF // 1P VS AI</span>
        </button>
      </div>
      <div class="gp-mobile-sticky-actions" style="text-align:center;">
        <button type="button" data-diff="back" style="
          padding:10px 28px;
          border-radius:12px;
          border:1px solid rgba(103,239,255,0.22);
          background:rgba(9,18,34,0.88);
          color:#8fb8cc;
          font:13px monospace;
          letter-spacing:.1em;
          cursor:pointer;
          pointer-events:auto;
        ">← BACK</button>
      </div>
    `;
    overlay.appendChild(difficultyPanel);

    const aiVsAiToggle = difficultyPanel.querySelector("[data-ai-vs-ai]");
    const aiVsAiStatus = difficultyPanel.querySelector("[data-ai-vs-ai-status]");
    const difficultyModeLabel = difficultyPanel.querySelector("#gp-difficulty-mode-label");
    function refreshAiVsAiToggle() {
      const on = aiVsAiMode;
      aiVsAiToggle.setAttribute("aria-pressed", String(on));
      aiVsAiToggle.style.borderColor = on ? "rgba(103,239,255,.82)" : "rgba(113,239,255,.34)";
      aiVsAiToggle.style.background = on ? "rgba(103,239,255,.16)" : "rgba(103,239,255,.055)";
      aiVsAiToggle.style.boxShadow = on ? "0 0 20px rgba(103,239,255,.22)" : "none";
      aiVsAiStatus.textContent = on ? "ON // BOTH PADDLES AI" : "OFF // 1P VS AI";
      aiVsAiStatus.style.color = on ? "#71efff" : "#668e9f";
      difficultyModeLabel.textContent = on ? "AI VS AI // SELECT A SHARED DIFFICULTY" : "1P VS AI";
    }
    aiVsAiToggle.addEventListener("click", () => {
      pongAudio.primeFromGesture();
      pongAudio.buttonHover();
      aiVsAiMode = !aiVsAiMode;
      refreshAiVsAiToggle();
      triggerMenuGlitch();
    });
    refreshAiVsAiToggle();

    // Hover glow for difficulty cards
    difficultyPanel.querySelectorAll("button[data-diff]").forEach(btn => {
      const diff = btn.getAttribute("data-diff");
      const glowColor = diff === "easy" ? "rgba(61,220,132,.18)" : diff === "medium" ? "rgba(255,209,102,.18)" : diff === "hard" ? "rgba(255,79,137,.18)" : "transparent";
      btn.addEventListener("mouseenter", () => { if(diff !== "back") btn.style.boxShadow = `0 0 22px ${glowColor}`; });
      btn.addEventListener("mouseleave", () => { btn.style.boxShadow = ""; });
      btn.addEventListener("pointerdown", () => { pongAudio.primeFromGesture(); pongAudio.buttonHover(); triggerMenuGlitch(); });
      btn.addEventListener("click", () => {
        if (diff === "back") { showArenaMenu(); return; }
        aiDifficulty = diff;
        beginMode(false);
      });
    });
    // ── END DIFFICULTY PANEL ────────────────────────────────────────────────

    const bars = [];
    for (let i = 0; i < 3; i++) {
      const bar = document.createElement("div");
      bar.style.cssText = [
        "position:absolute",
        "left:-15%",
        "top:" + (18 + i * 22) + "%",
        "width:130%",
        "height:" + (6 + i * 2) + "px",
        "background:linear-gradient(90deg, transparent, rgba(103,239,255,0.28), rgba(255,79,216,0.24), transparent)",
        "opacity:0",
        "pointer-events:none",
        "filter:blur(1px)"
      ].join(";");
      modeMenu.appendChild(bar);
      bars.push(bar);
    }

    const rgbGhost = document.createElement("div");
    rgbGhost.style.cssText = [
      "position:absolute",
      "inset:0",
      "background:url('" + PONG_MENU_SRC + "') center/100% 100% no-repeat",
      "mix-blend-mode:screen",
      "opacity:0",
      "pointer-events:none"
    ].join(";");
    modeMenu.appendChild(rgbGhost);

    function triggerMenuGlitch() {
      modeMenu.style.filter = "drop-shadow(0 0 18px rgba(103,239,255,0.26))";
      rgbGhost.style.opacity = "0.18";
      rgbGhost.style.transform = "translateX(4px)";
      setTimeout(() => {
        rgbGhost.style.opacity = "0.12";
        rgbGhost.style.transform = "translateX(-4px)";
      }, 50);
      setTimeout(() => {
        rgbGhost.style.opacity = "0";
        rgbGhost.style.transform = "translateX(0)";
        modeMenu.style.filter = "none";
      }, 180);

      bars.forEach((bar, i) => {
        bar.style.transition = "none";
        bar.style.opacity = (0.75 - i * 0.15).toString();
        bar.style.transform = "translateX(-6%)";
        void bar.offsetWidth;
        bar.style.transition = "transform 190ms linear, opacity 220ms ease";
        bar.style.transform = "translateX(18%)";
        bar.style.opacity = "0";
      });
    }

    function scheduleAmbientMenuGlitch() {
      const t = 1200 + Math.floor(Math.random() * 1800);
      state.timers.push(setTimeout(() => {
        if (!modeSelected && currentScreen === "mode" && modeMenu.style.display !== "none") {
          triggerMenuGlitch();
          scheduleAmbientMenuGlitch();
        }
      }, t));
    }

    const player1Btn = document.createElement("button");
    player1Btn.type = "button";
    player1Btn.setAttribute("aria-label", "Player 1");
    player1Btn.style.cssText = [
      "position:absolute",
      "left:35.2%",
      "top:56.4%",
      "width:30.2%",
      "height:12.6%",
      "background:transparent",
      "border:none",
      "cursor:pointer",
      "pointer-events:auto"
    ].join(";");

    const player2Btn = document.createElement("button");
    player2Btn.type = "button";
    player2Btn.setAttribute("aria-label", "Player 2");
    player2Btn.style.cssText = [
      "position:absolute",
      "left:35.2%",
      "top:74.4%",
      "width:30.2%",
      "height:12.6%",
      "background:transparent",
      "border:none",
      "cursor:pointer",
      "pointer-events:auto"
    ].join(";");

    [playBtn, settingsBtn, statsBtn, storeBtn, settingsBackBtn, statsBackBtn, storeBackBtn, player1Btn, player2Btn, pauseResumeBtn, pauseQuitBtn, pauseMusicBtn, pauseSfxBtn].forEach((btn) => {
      btn.addEventListener("mouseenter", () => {
        triggerMenuGlitch();
      });
      btn.addEventListener("pointerdown", () => {
        triggerMenuGlitch();
        pongAudio.primeFromGesture();
        pongAudio.buttonHover();
      }, { capture: true });
      btn.addEventListener("keydown", () => {
        triggerMenuGlitch();
        pongAudio.primeFromGesture();
        pongAudio.buttonHover();
      }, { capture: true });
      btn.addEventListener("mousedown", triggerMenuGlitch);
    });

    modeMenuImg.style.zIndex = "1";
    player1Btn.style.zIndex = "3";
    player2Btn.style.zIndex = "3";
    modeMenu.appendChild(modeMenuImg);
    modeMenu.appendChild(player1Btn);
    modeMenu.appendChild(player2Btn);
    overlay.appendChild(modeMenu);

    let menuAudioRevived = false;
    let menuAudioUnlockBound = false;

    function unlockAppAudio() {
      pongAudio.primeFromGesture();
      if (!menuAudioRevived) menuAudioRevived = true;
      if (currentScreen === "main" || currentScreen === "mode" || currentScreen === "arena" || currentScreen === "settings" || currentScreen === "stats" || currentScreen === "store") {
        pongAudio.startMenuMusic();
      }
    }

    function bindMenuAudioUnlock() {
      if (menuAudioUnlockBound) return;
      menuAudioUnlockBound = true;
      // Modern mobile browsers emit pointer events for touch. Listening for
      // both pointerdown and touchstart caused one tap to unlock/start audio
      // several times. Use touchstart only as a legacy fallback.
      if (window.PointerEvent) {
        document.addEventListener("pointerdown", unlockAppAudio, { capture: true });
      } else {
        document.addEventListener("touchstart", unlockAppAudio, { capture: true, passive: true });
      }
      document.addEventListener("keydown", unlockAppAudio, { capture: true });
    }

    bindMenuAudioUnlock();

    function syncUiForScreen() {
      mainMenu.style.display        = currentScreen === "main"       ? "block" : "none";
      settingsPanel.style.display   = currentScreen === "settings"   ? "block" : "none";
      statsPanel.style.display      = currentScreen === "stats"      ? "block" : "none";
      storePanel.style.display      = currentScreen === "store"      ? "block" : "none";
      multiplayerPanel.style.display = currentScreen === "multiplayer" ? "block" : "none";
      joinPanel.style.display       = currentScreen === "online-join" ? "block" : "none";
      onlineLobbyPanel.style.display = currentScreen === "online-lobby" ? "block" : "none";
      modeMenu.style.display        = currentScreen === "mode"       ? "block" : "none";
      arenaPanel.style.display      = currentScreen === "arena"      ? "block" : "none";
      difficultyPanel.style.display = currentScreen === "difficulty" ? "block" : "none";
      pauseMenu.style.display       = currentScreen === "game" && isPaused ? "block" : "none";
      const hudDisplay = currentScreen === "game" && !isPaused ? "block" : "none";
      hud.style.display  = hudDisplay;
      help.style.display = isMobileDevice ? "none" : hudDisplay;
      mobilePauseBtn.style.display = isMobileDevice && currentScreen === "game" && !isPaused && !gameOver && !progScreen ? "grid" : "none";
    }

    function showMainMenu() {
      currentScreen = "main";
      isPaused = false;
      mainMenu.style.background = "transparent";
      if (typeof mainMenuImg !== "undefined") mainMenuImg.src = MAIN_MENU_SRC;
      resetMenuDemo();
      triggerMenuGlitch();
      scheduleAmbientMenuGlitch();
      syncUiForScreen();
      pongAudio.startMenuMusic();
    }

    function hideMainMenu() {
      if (currentScreen === "main") currentScreen = "mode";
      syncUiForScreen();
    }

    function showModeMenu() {
      currentScreen = "mode";
      isPaused = false;
      modeMenu.style.backgroundImage = "url('" + PONG_MENU_SRC + "')";
      if (typeof modeMenuImg !== "undefined") modeMenuImg.src = PONG_MENU_SRC;
      resetMenuDemo();
      triggerMenuGlitch();
      scheduleAmbientMenuGlitch();
      syncUiForScreen();
      pongAudio.startMenuMusic();
    }

    function hideModeMenu() {
      if (currentScreen === "mode") currentScreen = "main";
      syncUiForScreen();
    }

    function showDifficultyMenu() {
      refreshAiVsAiToggle();
      currentScreen = "difficulty";
      syncUiForScreen();
    }

    function beginMode(twoPlayers) {
      pongAudio.primeFromGesture();
      ensureCountdownAssets();
      twoPlayerMode = !!twoPlayers;
      if (twoPlayerMode) aiVsAiMode = false;
      bossEncounteredThisMatch = false;
      modeSelected = true;
      currentScreen = "game";
      isPaused = false;
      syncUiForScreen();
      pongAudio.stopMenuMusic();
      leftScore = 0;
      rightScore = 0;
      winner = null;
      gameOver = false;
      finalScoreCinematic = false;
      finalScoreCinematicTimer = 0;
      finalScoreSide = null;
      finalScoreTrailSnapshot = [];
      finalScoreBallSnapshot = null;
      shakeFrames = 0;
      scoreFlashFrames = 0;
      glitchPulse = 0;
      heat = 0;
      rallyHits = 0;
      keys.w = false;
      keys.s = false;
      keys.up = false;
      keys.down = false;
      keys.shiftLeft = false;
      keys.shiftRight = false;
      resetPositions();
      resetBall(Math.random() > 0.5 ? 1 : -1);
      syncUiForScreen();
      startRoundCountdown();
      // Reset per-match progression tracking
      GlitchProgression.beginMatch();
      matchStartLevel  = GlitchProgression.level;
      matchRallyHits = 0;
      progScreen = null;
      xpFloats = [];
      matchWinner = null;
      progSummaryData = null;
      progSummaryTimer = 0;
      clearGlitchWalls();
      // Init/reinit arena overlay
      const _startArena = getArena();
      if (_startArena.cleanup) _startArena.cleanup();
      if (_startArena.init)    _startArena.init();
    }

    function returnToMainMenu() {
      disconnectOnline();
      isPaused = false;
      modeSelected = false;
      twoPlayerMode = false;
      bossEncounteredThisMatch = false;
      gameOver = false;
      winner = null;
      finalScoreCinematic = false;
      finalScoreCinematicTimer = 0;
      finalScoreSide = null;
      finalScoreTrailSnapshot = [];
      finalScoreBallSnapshot = null;
      leftScore = 0;
      rightScore = 0;
      roundFrozen = true;
      countdownActive = false;
      countdownPhaseIndex = -1;
      countdownFrame = 0;
      shakeFrames = 0;
      scoreFlashFrames = 0;
      glitchPulse = 0;
      heat = 0;
      rallyHits = 0;
      keys.w = false;
      keys.s = false;
      keys.up = false;
      keys.down = false;
      keys.shiftLeft = false;
      keys.shiftRight = false;
      progScreen = null;
      xpFloats = [];
      progSummaryData = null;
      progSummaryTimer = 0;
      clearGlitchWalls();
      resetPositions();
      pongAudio.stopGameMusic();
      currentScreen = "main";
      syncUiForScreen();
      showMainMenu();
    }

    playBtn.addEventListener("click", () => {
      triggerMenuGlitch();
      hideMainMenu();
      showModeMenu();
    });

    settingsBtn.addEventListener("click", () => {
      triggerMenuGlitch();
      currentScreen = "settings";
      switchSettingsTab("controls"); // reset to controls tab each open
      syncUiForScreen();
    });

    storeBtn.addEventListener("click", () => {
      triggerMenuGlitch();
      currentScreen = "store";
      syncUiForScreen();
    });

    statsBtn.addEventListener("click", () => {
      triggerMenuGlitch();
      buildStatsPane();
      currentScreen = "stats";
      syncUiForScreen();
    });

    settingsBackBtn.addEventListener("click", () => {
      triggerMenuGlitch();
      showMainMenu();
    });

    storeBackBtn.addEventListener("click", () => {
      triggerMenuGlitch();
      showMainMenu();
    });

    statsBackBtn.addEventListener("click", () => {
      triggerMenuGlitch();
      showMainMenu();
    });

    pauseResumeBtn.addEventListener("click", () => {
      pongAudio.primeFromGesture();
      hidePauseMenu();
    });

    pauseQuitBtn.addEventListener("click", () => {
      pongAudio.primeFromGesture();
      pongAudio.stopMenuMusic();
      returnToMainMenu();
    });

    pauseMusicBtn.addEventListener("click", () => {
      pongAudio.primeFromGesture();
      const nextValue = !pongAudio.isMusicEnabled();
      pongAudio.setMusicEnabled(nextValue);
      refreshPauseAudioIndicators();
      if (pongAudio.isSfxEnabled()) pongAudio.buttonHover();
    });

    pauseSfxBtn.addEventListener("click", () => {
      const nextValue = !pongAudio.isSfxEnabled();
      pongAudio.setSfxEnabled(nextValue);
      refreshPauseAudioIndicators();
      if (nextValue) pongAudio.buttonHover();
    });

    player1Btn.addEventListener("click", () => {
      triggerMenuGlitch();
      pendingTwoPlayer = false;
      showArenaMenu();
    });
    player2Btn.addEventListener("click", () => {
      triggerMenuGlitch();
      currentScreen = "multiplayer";
      syncUiForScreen();
    });

    // ── Arena Select Panel ────────────────────────────────────────────────
    const arenaPanel = document.createElement("div");
    arenaPanel.id = "gp-arena-panel";
    arenaPanel.classList.add("gp-mobile-panel");
    arenaPanel.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "z-index:2147483648",
      "width:min(680px,90vw)",
      "padding:28px 26px 24px",
      "border:1px solid rgba(103,239,255,0.28)",
      "border-radius:24px",
      "background:linear-gradient(180deg,rgba(8,15,28,0.97),rgba(5,9,18,0.97))",
      "box-shadow:0 0 40px rgba(103,239,255,0.13),0 0 70px rgba(255,79,216,0.08)",
      "color:#eafcff",
      "font:15px/1.5 monospace",
      "pointer-events:auto",
      "display:none"
    ].join(";");

    let _arenaSelectedIdx = 0;

    function arenaRgba(arena, alpha) {
      const hex = arena.accent.replace("#", "");
      const value = parseInt(hex, 16);
      return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
    }

    function buildArenaPanel() {
      _arenaSelectedIdx = Math.max(0, ARENA_REGISTRY.findIndex(a => a.id === currentArenaId));
      const sel = _arenaSelectedIdx;

      const makeCard = (a, i) => {
        const isSel = i === sel;
        const accentSolid = a.accent;
        const textSub = arenaRgba(a, 0.50);
        const bg = isSel
          ? `background:${arenaRgba(a, 0.12)};border:1px solid ${arenaRgba(a, 0.65)};box-shadow:0 0 22px ${arenaRgba(a, 0.20)};`
          : `background:${arenaRgba(a, 0.05)};border:1px solid ${arenaRgba(a, 0.28)};`;
        return `
          <button type="button" class="gp-arena-card" data-arena-i="${i}" style="
            ${bg}
            border-radius:16px;
            padding:18px 10px 16px;
            cursor:pointer;
            color:#eafcff;
            font:14px monospace;
            text-align:center;
            transition:background .15s,box-shadow .15s;
            pointer-events:auto;
          ">
            <div style="font:bold 22px/1 monospace;letter-spacing:.10em;
              color:${accentSolid};margin-bottom:10px;
              text-shadow:0 0 14px ${arenaRgba(a, 0.4)};">${a.name}</div>
            <div style="font-size:10px;line-height:1.7;color:${textSub};letter-spacing:.04em;">
              ${a.subtitle.replace(" // ", "<br>")}
            </div>
            ${isSel ? `<div style="font-size:10px;line-height:1.6;margin-top:10px;
              color:rgba(200,240,220,0.55);letter-spacing:.02em;">${a.desc}</div>` : ""}
            <div style="margin-top:10px;">
              ${a.tags.map(t => `<span style="display:inline-block;font:8px monospace;
                padding:2px 7px;border-radius:4px;margin:2px;
                background:${arenaRgba(a, 0.10)};color:${accentSolid};
                letter-spacing:.06em;">${t}</span>`).join("")}
            </div>
          </button>`;
      };

      arenaPanel.innerHTML = `
        <div class="gp-arena-title" style="text-align:center;font:bold 26px/1.1 monospace;letter-spacing:.16em;
          color:#71efff;margin-bottom:6px;text-shadow:0 0 20px rgba(113,239,255,.2);">
          SELECT ARENA
        </div>
        <div class="gp-arena-hint" style="text-align:center;font:12px monospace;color:#5a7a8a;
          letter-spacing:.1em;margin-bottom:22px;">
          ← → NAVIGATE &nbsp;·&nbsp; ENTER CONFIRM &nbsp;·&nbsp; ESC BACK
        </div>
        <div class="gp-arena-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
          gap:14px;margin-bottom:22px;">
          ${ARENA_REGISTRY.map((a, i) => makeCard(a, i)).join("")}
        </div>
        <div class="gp-mobile-sticky-actions" style="text-align:center;">
          <button type="button" data-arena-i="back" style="
            padding:10px 28px;border-radius:12px;
            border:1px solid rgba(103,239,255,0.22);
            background:rgba(9,18,34,0.88);color:#8fb8cc;
            font:13px monospace;letter-spacing:.1em;
            cursor:pointer;pointer-events:auto;">← BACK</button>
        </div>`;

      if (isMobileDevice) {
        const mobileHint = arenaPanel.querySelector(".gp-arena-hint");
        if (mobileHint) mobileHint.textContent = "SWIPE OR TAP AN ARENA";
      }

      // Card hover glow
      arenaPanel.querySelectorAll("[data-arena-i]").forEach(btn => {
        const idx = btn.getAttribute("data-arena-i");
        if (idx === "back") {
          btn.addEventListener("click", () => { triggerMenuGlitch(); showModeMenu(); });
          return;
        }
        const i = parseInt(idx);
        const accent = arenaRgba(ARENA_REGISTRY[i], 0.16);
        btn.addEventListener("mouseenter", () => { if (i !== _arenaSelectedIdx) btn.style.boxShadow = `0 0 14px ${accent}`; });
        btn.addEventListener("mouseleave", () => { if (i !== _arenaSelectedIdx) btn.style.boxShadow = ""; });
        btn.addEventListener("click", () => {
          _arenaSelectedIdx = i;
          currentArenaId    = ARENA_REGISTRY[i].id;
          confirmArena(); // single click = confirm and start
        });
      });
      if (isMobileDevice) {
        requestAnimationFrame(() => {
          const selectedCard = arenaPanel.querySelector(`.gp-arena-card[data-arena-i="${sel}"]`);
          if (selectedCard) selectedCard.scrollIntoView({ block: "nearest", inline: "center" });
        });
      }
    }

    function confirmArena() {
      triggerMenuGlitch();
      currentArenaId = ARENA_REGISTRY[_arenaSelectedIdx].id;
      const arena = getArena();
      if (arena.cleanup) arena.cleanup();
      if (arena.init)    arena.init();
      pendingTwoPlayer ? beginMode(true) : showDifficultyMenu();
    }

    arenaPanel.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" ||
          e.key === "ArrowUp"   || e.key === "ArrowDown") {
        e.preventDefault();
        const dir = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1 : -1;
        _arenaSelectedIdx = Math.max(0, Math.min(ARENA_REGISTRY.length - 1, _arenaSelectedIdx + dir));
        currentArenaId    = ARENA_REGISTRY[_arenaSelectedIdx].id;
        buildArenaPanel();
      }
      if (e.key === "Enter")  confirmArena();
      if (e.key === "Escape") { triggerMenuGlitch(); showModeMenu(); }
    });

    function showArenaMenu() {
      currentScreen = "arena";
      buildArenaPanel();
      syncUiForScreen();
      setTimeout(() => arenaPanel.focus(), 30);
    }

    overlay.appendChild(arenaPanel);

    // ── Menu attract-mode renderer ─────────────────────────────────────────
    // Runs every frame while modeSelected is false (main menu, mode select,
    // settings, difficulty screens). Always renders the CLASSIC arena so the
    // main menu background is always the default map regardless of which arena
    // the player last selected.
    function renderWaitingScreen() {
      updateMenuDemo();
      const savedArenaId = currentArenaId;
      currentArenaId = "classic";   // force classic for the menu background
      drawArenaBase(0.18, true);
      drawArenaOverlay();           // no-op for classic (hasOverlay:false)
      drawScreenSpacePaddles();
      currentArenaId = savedArenaId;
    }

    function loop(now = performance.now()) {
      sampleAdaptiveQuality(now);
      // Always clear canvas first — prevents old content from bleeding through
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      breachFlashFrames = Math.max(0, breachFlashFrames - 1);

      if (!modeSelected) {
        renderWaitingScreen();
        state.raf = requestAnimationFrame(loop);
        return;
      }

      // Online snapshots are authoritative. Rendering reuses the existing arena,
      // particle, HUD, and audio presentation, but never advances local physics.
      if (onlineState.active) {
        if (onlineState.snapshot) applyOnlineSnapshot(onlineState.snapshot);
        render();
        state.raf = requestAnimationFrame(loop);
        return;
      }

      if (isPaused) {
        render();
        state.raf = requestAnimationFrame(loop);
        return;
      }

      if (gameOver) {
        scoreFlashFrames = Math.max(0, scoreFlashFrames - 1);
        glitchPulse = Math.max(0, glitchPulse - 1);
        render();
        state.raf = requestAnimationFrame(loop);
        return;
      }

      if (finalScoreCinematic) {
        finalPointSlowMo = false;
        finalPointSlowMoMix += (0 - finalPointSlowMoMix) * 0.18;
        finalScoreCinematicTimer -= 1;
        scoreFlashFrames = Math.max(0, scoreFlashFrames - 1);
        glitchPulse = Math.max(0, glitchPulse - 1);
        cameraTargetZoom = Math.max(cameraTargetZoom, 1.1);
        render();
        if (finalScoreCinematicTimer <= 0) {
          finalScoreCinematic = false;
          gameOver = true;
          pongAudio.stopGameMusic();
          cameraTargetZoom = 1.06;

          // ── Build match summary ───────────────────────────────────────────
          matchWinner = finalScoreSide === "LEFT" ? "left" : "right";
          const profileSide = onlineState.active && onlineState.session ? onlineState.session.side : "left";
          const playerWon = matchWinner === profileSide;
          const playerScore = profileSide === "left" ? leftScore : rightScore;
          const opponentScore = profileSide === "left" ? rightScore : leftScore;
          const summaryResult = aiVsAiMode
            ? { totalXP: 0, breakdown: {} }
            : GlitchProgression.endMatch(playerWon, clutchMode, {
                arenaId: currentArenaId,
                playerScore,
                opponentScore
              });
          progSummaryData = {
            totalXP:     summaryResult.totalXP    || 0,
            breakdown:   summaryResult.breakdown  || {},
            levelBefore: matchStartLevel,
            levelAfter:  GlitchProgression.level
          };
          progSummaryTimer = 0;
          progScreen = "matchSummary";
        }
        state.raf = requestAnimationFrame(loop);
        return;
      }

      if (countdownActive) {
        updateCountdown();
        scoreFlashFrames = Math.max(0, scoreFlashFrames - 1);
        glitchPulse = Math.max(0, glitchPulse - 1);
        finalPointSlowMo = false;
        finalPointSlowMoMix += (0 - finalPointSlowMoMix) * 0.18;
        render();
        state.raf = requestAnimationFrame(loop);
        return;
      }

      // Level-up and perk screens are true gameplay pauses. Render the frozen
      // arena behind the overlay, but do not advance paddles, ball, Heat, AI,
      // boss logic, or power-ups until the player dismisses the screen.
      if (progScreen === "levelUp" || progScreen === "perkSelect") {
        render();
        if (progScreen === "levelUp") drawLevelUpScreen();
        else drawPerkSelectScreen();
        state.raf = requestAnimationFrame(loop);
        return;
      }

      if (leftDashCooldown > 0) {
        leftDashCooldown -= 1;
        if (leftDashCooldown === 0) pongAudio.dashReady();
      }
      if (rightDashCooldown > 0) {
        rightDashCooldown -= 1;
        if (rightDashCooldown === 0) pongAudio.dashReady();
      }
      leftDashTrail = leftDashTrail.map((trail) => ({ ...trail, life: trail.life - 1 })).filter((trail) => trail.life > 0);
      rightDashTrail = rightDashTrail.map((trail) => ({ ...trail, life: trail.life - 1 })).filter((trail) => trail.life > 0);
      updateArenaPowerup();

      if (aiVsAiMode) {
        updateAiPaddle("left");
      } else {
        if (keys.w) leftY -= Math.round(8 * (1 + GlitchProgression.getPerkStat("paddleSpeedBonus")));
        if (keys.s) leftY += Math.round(8 * (1 + GlitchProgression.getPerkStat("paddleSpeedBonus")));
      }

      if (twoPlayerMode) {
        if (keys.up)   rightY -= Math.round(8 * (1 + GlitchProgression.getPerkStat("paddleSpeedBonus")));
        if (keys.down) rightY += Math.round(8 * (1 + GlitchProgression.getPerkStat("paddleSpeedBonus")));
      } else {
        updateAiPaddle("right");
      }

      leftY = clamp(leftY, 0, canvas.height - paddleH);
      rightY = clamp(rightY, 0, canvas.height - paddleH);

      if (bossModeActive) {
        finalPointSlowMo = false;
        finalPointSlowMoMix += (0 - finalPointSlowMoMix) * 0.18;
        const bossAiTarget = bossData && bossData.projectile && bossData.projectile.target;
        if (!twoPlayerMode && bossAiTarget && (bossAiTarget === "right" || aiVsAiMode)) {
          updateAiPaddle(bossAiTarget, {
            ballX: bossData.projectile.x,
            ballY: bossData.projectile.y,
            vx: bossData.projectile.vx,
            vy: bossData.projectile.vy
          });
          if (bossAiTarget === "left") leftY = clamp(leftY, 0, canvas.height - paddleH);
          else rightY = clamp(rightY, 0, canvas.height - paddleH);
        }
        updateBossFight();
        scoreFlashFrames = Math.max(0, scoreFlashFrames - 1);
        glitchPulse = Math.max(0, glitchPulse - 1);
        render();
        state.raf = requestAnimationFrame(loop);
        return;
      }

      if (shakeFrames > 0) {
        shakeFrames -= 1;
        scoreFlashFrames = Math.max(0, scoreFlashFrames - 1);
        glitchPulse = Math.max(0, glitchPulse - 1);
        cameraTargetZoom = Math.max(cameraTargetZoom, 1.02);
        render();
        if (shakeFrames === 0) {
          launchBallToPlayer();
        }
        state.raf = requestAnimationFrame(loop);
        return;
      }

      if (impactFreezeFrames > 0) {
        impactFreezeFrames -= 1;
        scoreFlashFrames = Math.max(0, scoreFlashFrames - 1);
        glitchPulse = Math.max(0, glitchPulse - 1);
        render();
        state.raf = requestAnimationFrame(loop);
        return;
      }

      finalPointSlowMo = false;
      finalPointSlowMoMix += (0 - finalPointSlowMoMix) * 0.12;

      if (!roundFrozen) {
        const clutchBoost = clutchMode ? 0.22 : 0;
        const heatRatio = getHeatRatio();
        heat = Math.max(0, heat - (HEAT_DECAY_BASE + heatRatio * HEAT_DECAY_SCALE) + clutchBoost);

        decoyCooldown -= 1;
        if (decoyCooldown <= 0 && heat > 40) {
          decoyCooldown = Math.max(150, 300 - Math.floor(heatRatio * 100)) + Math.floor(Math.random() * 180);
          decoys.push({
            x: ballX,
            y: ballY,
            vx: vx * (1 + (Math.random() - 0.5) * 0.3),
            vy: vy * (1 + (Math.random() - 0.5) * 0.3),
            life: 45 + Math.floor(Math.random() * 20),
            maxLife: 64
          });
          if (decoys.length > 3) decoys.shift();
        }

        for (let i = decoys.length - 1; i >= 0; i--) {
          const decoy = decoys[i];
          const decoyTimeScale = 1;
          decoy.x += decoy.vx * decoyTimeScale;
          decoy.y += decoy.vy * decoyTimeScale;
          decoy.life -= 1;
          if (decoy.y <= 10 || decoy.y >= canvas.height - 10) decoy.vy *= -1;
          if (decoy.life <= 0 || decoy.x < -40 || decoy.x > canvas.width + 40) {
            decoys.splice(i, 1);
          }
        }

        if (pulseFrames > 0) {
          pulseFrames--;
          if (pulseFrames === 0) {
            if (speedMultiplier !== 1) {
              vx /= speedMultiplier;
              vy /= speedMultiplier;
              speedMultiplier = 1;
            }
            pulseCooldown = Math.max(90, 240 - Math.floor(heatRatio * 90)) + Math.floor(Math.random() * 220);
          }
        } else if (pulseCooldown > 0) {
          pulseCooldown--;
        } else {
          pulseFrames = 30 + Math.floor(Math.random() * (40 + heatRatio * 18));
          speedMultiplier = Math.random() < 0.5 ? (1.22 + heatRatio * 0.2) : Math.max(0.7, 0.72 - heatRatio * 0.06);
          vx *= speedMultiplier;
          vy *= speedMultiplier;
          glitchPulse = Math.max(glitchPulse, 6 + Math.floor(heatRatio * 8));
        }

        if (teleportCooldown > 0) {
          teleportCooldown--;
        } else {
          ballX = canvas.width * (0.2 + Math.random() * 0.6);
          ballY = canvas.height * (0.15 + Math.random() * 0.7);
          if (Math.random() < 0.5 + heatRatio * 0.15) vx = -vx;
          if (Math.random() < 0.35 + heatRatio * 0.2) vy = -vy;
          glitchPulse = Math.max(glitchPulse, 8 + Math.floor(heatRatio * 10));
          triggerCameraKick((Math.random() - 0.5) * (14 + heatRatio * 10), (Math.random() - 0.5) * (10 + heatRatio * 8), 0.012 + heatRatio * 0.01);
          if (speedMultiplier !== 1) {
            vx /= speedMultiplier;
            vy /= speedMultiplier;
            speedMultiplier = 1;
          }
          pulseFrames = 0;
          pulseCooldown = Math.max(90, 240 - Math.floor(heatRatio * 90)) + Math.floor(Math.random() * 220);
          teleportCooldown = Math.max(220, 600 - Math.floor(heatRatio * 180)) + Math.floor(Math.random() * 500);
          ballTrail = [];
          pongAudio.teleport();
        }

        if (jukeCooldown > 0) {
          jukeCooldown--;
        } else if (ballX > canvas.width * 0.25 && ballX < canvas.width * 0.75 && ballY > 50 && ballY < canvas.height - 50) {
          const jukeChance = 0.01 + heatRatio * 0.018 + (clutchMode ? 0.008 : 0);
          if (Math.random() < jukeChance) {
            vy = -vy * (1 + heatRatio * 0.08);
            glitchPulse = Math.max(glitchPulse, 4 + Math.floor(heatRatio * 8));
            jukeCooldown = Math.max(100, 300 - Math.floor(heatRatio * 120)) + Math.floor(Math.random() * 220);
            pongAudio.juke();
          }
        }

        const clutchVelocityScale = clutchMode ? (1.08 + GlitchProgression.getPerkStat("clutchBoost")) : 1;
        const roundTimeScale = 1;
        updateBlackHoleNexusGameplay(heatRatio);
        ballX += vx * clutchVelocityScale * roundTimeScale;
        ballY += vy * clutchVelocityScale * roundTimeScale;

        // ── Ball Sentience ─────────────────────────────────────────────────
        if (rallyHits >= 30) {
          exhaustionPhase += 0.09;
          exhaustionAmp = Math.min(0.55, (rallyHits - 30) * 0.018);
          vy += Math.sin(exhaustionPhase) * exhaustionAmp;

          // First time crossing the threshold — trigger the warning flash
          if (!drowsyWarningShown) {
            drowsyWarningTimer = 210;
            drowsyWarningShown = true;
          }
          // Spawn a new Z every ~24 frames
          drowsyZSpawnTimer--;
          if (drowsyZSpawnTimer <= 0) {
            drowsyZSpawnTimer = 22 + Math.floor(Math.random() * 14);
            const startSize = 9 + Math.random() * 7;
            drowsyZs.push({
              x:       ballX + (Math.random() - 0.5) * 16,
              y:       ballY - BALL_R - 4,
              vx:      (Math.random() - 0.5) * 0.45,
              vy:      -(0.7 + Math.random() * 0.7),
              size:    startSize,
              rot:     (Math.random() - 0.5) * 0.5,
              life:    70 + Math.floor(Math.random() * 55),
              maxLife: 70 + Math.floor(Math.random() * 55)
            });
          }
          // Advance existing Z particles
          for (let i = drowsyZs.length - 1; i >= 0; i--) {
            const z = drowsyZs[i];
            z.x    += z.vx;
            z.y    += z.vy;
            z.size  = Math.min(22, z.size + 0.07);
            z.life--;
            if (z.life <= 0) drowsyZs.splice(i, 1);
          }
        } else {
          exhaustionPhase   = 0;
          exhaustionAmp     = 0;
          drowsyZs          = [];
          drowsyZSpawnTimer = 0;
          drowsyWarningShown = false;
        }
        if (drowsyWarningTimer > 0) drowsyWarningTimer--;

        // Speed cap — only reduce vy, never erode vx
        const _spd = Math.hypot(vx, vy);
        if (_spd > 22) {
          const maxVy = Math.sqrt(Math.max(0, 22 * 22 - vx * vx));
          if (Math.abs(vy) > maxVy) vy = Math.sign(vy) * maxVy;
        }

        const trailScale = Math.min(3, 1 + (colorCharge - 1) * 0.45);
        ballTrail.unshift({ x: ballX, y: ballY });
        if (ballTrail.length > ghostTrailLimit * trailScale) ballTrail.pop();

        if (ballY <= BALL_R || ballY >= canvas.height - BALL_R) {
          vy *= -1;
          if (spiteBias !== 0) {
            const losingCenterY = spiteBias > 0 ? rightY + paddleH / 2 : leftY + paddleH / 2;
            const pull = (losingCenterY - ballY) / canvas.height * spiteBias * 0.6;
            vy = clamp(vy + pull, -8, 8);
          }
          pongAudio.wallBounce();
          const now = Date.now();
          if (now - lastWallBounceTime < 1000) {
            lastWallBounceTime = 0;
            ballX = canvas.width * (0.28 + Math.random() * 0.44);
            ballY = canvas.height * (0.22 + Math.random() * 0.56);
            vy = (Math.random() < 0.5 ? 1 : -1) * (3 + Math.random() * 2.5);
            if (Math.abs(vx) < 4) vx = Math.sign(vx) * 4;
            ballTrail = [];
            glitchPulse = Math.max(glitchPulse, 16);
            triggerCameraKick((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, 0.010);
            pongAudio.teleport();
          } else { lastWallBounceTime = now; }
        }

        checkPowerupCollection();

        const leftShieldPad = powerState.blue.shieldTimer > 0 ? 18 : 0;
        const rightShieldPad = powerState.red.shieldTimer > 0 ? 18 : 0;

        if (ballX <= leftX + paddleW && ballY >= leftY - leftShieldPad && ballY <= leftY + paddleH + leftShieldPad) {
          const returnHeat = getHeatRatio();
          const leftState = powerState.blue;
          const strikeBoost = leftState.powerStrikeReady ? 0.22 : 0;
          vx = Math.max(4.0, Math.abs(vx)) * (1 + returnHeat * 0.035 + Math.min(combo * 0.01, 0.08) + strikeBoost);
          vy += (ballY - (leftY + paddleH / 2)) * 0.04;
          vy = clamp(vy, -9, 9);
          if (leftState.shieldTimer > 0) { vx *= 0.96; vy *= 0.98; }
          heat = Math.min(HEAT_MAX, heat + HEAT_PER_HIT * (1 - GlitchProgression.getPerkStat("heatResistance")));
          rallyHits += 1; matchRallyHits++; combo += 1; comboTimer = COMBO_MAX_TIME;
          ballOwner = "blue";
          awardXP(GlitchProgression.XP_REWARDS.paddleHit, "paddleHit", leftX + paddleW + 20, ballY);
          if (rallyHits > 0 && rallyHits % 10 === 0) {
            awardXP(GlitchProgression.XP_REWARDS.longRally, "longRally", canvas.width / 2, 40);
            if (GlitchProgression.hasPerk("packet")) { vx *= 1.10; vy *= 1.10; }
          }
          if (!aiVsAiMode) GlitchProgression.trackRally(matchRallyHits);
          updateColorCharge("left"); pongAudio.paddleHitCharged(colorCharge);
          glitchPulse = Math.max(glitchPulse, 8 + Math.min(10, Math.floor(returnHeat * 10)));
          triggerCameraKick(10 + returnHeat * 10, (Math.random() - 0.5) * (6 + returnHeat * 6), 0.008 + returnHeat * 0.012);
          impactFreezeFrames = Math.max(impactFreezeFrames, 1);
          if (leftState.powerStrikeReady) { leftState.powerStrikeReady = false; glitchPulse = Math.max(glitchPulse, 18); pongAudio.critical(); }
          if (leftState.splitReady) { leftState.splitReady = false; spawnSplitDecoys(1); }
          if (heat >= 72 && rallyHits % 4 === 0) pongAudio.critical();
          if (!bossModeActive && !bossTriggeredThisRally && !preBossActive && heat >= HEAT_MAX) triggerPreBoss();
          if (!bossModeActive) applyBallInstability();
        }

        if (ballX >= rightX && ballY >= rightY - rightShieldPad && ballY <= rightY + paddleH + rightShieldPad) {
          const returnHeat = getHeatRatio();
          const rightState = powerState.red;
          const strikeBoost = rightState.powerStrikeReady ? 0.40 : 0;
          vx = -Math.max(4.0, Math.abs(vx)) * (1 + returnHeat * 0.035 + Math.min(combo * 0.01, 0.08) + strikeBoost);
          vy += (ballY - (rightY + paddleH / 2)) * 0.04;
          vy = clamp(vy, -9, 9);
          if (rightState.shieldTimer > 0) { vx *= 0.96; vy *= 0.98; }
          heat = Math.min(HEAT_MAX, heat + HEAT_PER_HIT * (1 - GlitchProgression.getPerkStat("heatResistance")));
          rallyHits += 1; matchRallyHits++; combo += 1; comboTimer = COMBO_MAX_TIME;
          ballOwner = "red";
          awardXP(GlitchProgression.XP_REWARDS.paddleHit, "paddleHit", rightX - 20, ballY);
          if (rallyHits > 0 && rallyHits % 10 === 0) awardXP(GlitchProgression.XP_REWARDS.longRally, "longRally", canvas.width / 2, 40);
          if (!aiVsAiMode) GlitchProgression.trackRally(matchRallyHits);
          updateColorCharge("right"); pongAudio.paddleHitCharged(colorCharge);
          glitchPulse = Math.max(glitchPulse, 8 + Math.min(10, Math.floor(returnHeat * 10)));
          triggerCameraKick(-(10 + returnHeat * 10), (Math.random() - 0.5) * (6 + returnHeat * 6), 0.008 + returnHeat * 0.012);
          impactFreezeFrames = Math.max(impactFreezeFrames, 1);
          pongAudio.paddleHit();
          if (rightState.powerStrikeReady) {
            rightState.powerStrikeReady = false;
            glitchPulse = Math.max(glitchPulse, 18);
            pongAudio.critical();
          }
          if (rightState.splitReady) {
            rightState.splitReady = false;
            spawnSplitDecoys(-1);
          }
          if (heat >= 72 && rallyHits % 4 === 0) pongAudio.critical();
          if (!bossModeActive && !bossTriggeredThisRally && !preBossActive && heat >= HEAT_MAX) triggerPreBoss();
          if (!bossModeActive) applyBallInstability();
        }

        // ── Scoring ────────────────────────────────────────────────────────
        if (!bossModeActive && ballX < 0) {
          const nearMissThreshold = 28;
          const missedClose = ballY > leftY - nearMissThreshold && ballY < leftY + paddleH + nearMissThreshold && (ballY < leftY || ballY > leftY + paddleH);
          if (missedClose) awardXP(GlitchProgression.XP_REWARDS.nearMiss, "nearMiss", leftX + 20, ballY);
          if (powerState.blue.shieldTimer > 0) {
            powerState.blue.shieldTimer = 0;
            vx = Math.abs(vx) * 0.92; vy += (ballY - canvas.height / 2) * 0.022;
            ballX = leftX + paddleW + BALL_R + 2;
            glitchPulse = Math.max(glitchPulse, 24);
            triggerCameraKick(14, (Math.random() - 0.5) * 10, 0.014);
            impactFreezeFrames = Math.max(impactFreezeFrames, 2);
            pongAudio.paddleHit();
          } else {
            const colorMatchBonusL = criticalHeat ? 3 : 2;
            rightScore += ballOwner === "blue" ? colorMatchBonusL : 1;
            missMemory.left.push(ballY); if (missMemory.left.length > 3) missMemory.left.shift();
            spiteBias = Math.sign(rightScore - leftScore) * Math.min(1, Math.abs(rightScore - leftScore) * 0.4);
            awardXP(GlitchProgression.XP_REWARDS.scorePoint, "scorePoint", canvas.width * 0.75, canvas.height * 0.5);
            if (clutchMode) awardXP(GlitchProgression.XP_REWARDS.clutchPoint, "clutchPoint", canvas.width * 0.75, canvas.height * 0.4);
            matchRallyHits = 0; exhaustionPhase = 0; exhaustionAmp = 0; lastWallBounceTime = 0; drowsyZs = []; drowsyZSpawnTimer = 0; drowsyWarningShown = false;
            colorCharge = 1; lastHitSide = null; clearGlitchWalls();
            if (rightScore >= WIN_SCORE) { rightScore = Math.max(rightScore, WIN_SCORE); startFinalScoreCinematic("RIGHT"); }
            else triggerScoreShake(1);
          }
        } else if (ballX > canvas.width) {
          const nearMissThreshold = 28;
          const missedClose = ballY > rightY - nearMissThreshold && ballY < rightY + paddleH + nearMissThreshold && (ballY < rightY || ballY > rightY + paddleH);
          if (missedClose) awardXP(GlitchProgression.XP_REWARDS.nearMiss, "nearMiss", rightX - 20, ballY);
          if (powerState.red.shieldTimer > 0) {
            powerState.red.shieldTimer = 0;
            vx = -Math.abs(vx) * 0.92; vy += (ballY - canvas.height / 2) * 0.022;
            ballX = rightX - BALL_R - 2;
            glitchPulse = Math.max(glitchPulse, 24);
            triggerCameraKick(-14, (Math.random() - 0.5) * 10, 0.014);
            impactFreezeFrames = Math.max(impactFreezeFrames, 2);
            pongAudio.paddleHit();
          } else {
            const colorMatchBonusR = criticalHeat ? 3 : 2;
            leftScore += ballOwner === "red" ? colorMatchBonusR : 1;
            missMemory.right.push(ballY); if (missMemory.right.length > 3) missMemory.right.shift();
            spiteBias = Math.sign(rightScore - leftScore) * Math.min(1, Math.abs(rightScore - leftScore) * 0.4);
            awardXP(GlitchProgression.XP_REWARDS.scorePoint, "scorePoint", canvas.width * 0.25, canvas.height * 0.5);
            if (clutchMode) awardXP(GlitchProgression.XP_REWARDS.clutchPoint, "clutchPoint", canvas.width * 0.25, canvas.height * 0.4);
            matchRallyHits = 0; exhaustionPhase = 0; exhaustionAmp = 0; lastWallBounceTime = 0; drowsyZs = []; drowsyZSpawnTimer = 0; drowsyWarningShown = false;
            colorCharge = 1; lastHitSide = null; clearGlitchWalls();
            if (leftScore >= WIN_SCORE) { leftScore = Math.max(leftScore, WIN_SCORE); startFinalScoreCinematic("LEFT"); }
            else triggerScoreShake(-1);
          }
        }
      }

      // ── Critical Heat ──────────────────────────────────────────────────
      const wasCritical = criticalHeat;
      criticalHeat = (heat >= HEAT_CRITICAL && !bossModeActive && !roundFrozen);
      if (criticalHeat && !wasCritical) { criticalHeatTimer = 160; glitchPulse = Math.max(glitchPulse, 20); }

      // ── Glitch Walls ───────────────────────────────────────────────────
      if (--glitchWallSpawnCooldown <= 0) {
        const hr = getHeatRatio();
        glitchWallSpawnCooldown = hr < 0.50 ? 260 + Math.floor(Math.random() * 180)
                                : hr < 0.70 ? 130 + Math.floor(Math.random() * 110)
                                :              60 + Math.floor(Math.random() * 70);
        trySpawnGlitchWall();
      }
      updateGlitchWalls();
      if (!roundFrozen) checkGlitchWallCollisions();

      // ── Pre-boss cinematic update ──────────────────────────────────────
      updatePreBoss();

      scoreFlashFrames = Math.max(0, scoreFlashFrames - 1);
      glitchPulse = Math.max(0, glitchPulse - 1);

      render();

      // ── Progression overlays ───────────────────────────────────────────
      if (currentScreen === "game") {
        drawHeatBar();
        drawXPBar();
        drawXPFloats();
        GlitchProgression.drainXPQueue();
        processPendingLevelUps();
        if (progScreen === "levelUp")          drawLevelUpScreen();
        else if (progScreen === "perkSelect")  drawPerkSelectScreen();
        else if (progScreen === "matchSummary") drawMatchSummary();
        drawPreBoss();
        drawCriticalHeatWarning();
        drawDrowsyWarning();
      }

      state.raf = requestAnimationFrame(loop);
    }

    function handleEscapeAction() {
      if (currentScreen === "game") {
        if (gameOver) { returnToMainMenu(); return; }
        if (isPaused) hidePauseMenu();
        else showPauseMenu();
        return;
      }
      if (currentScreen === "arena")      { showModeMenu();    return; }
      if (currentScreen === "difficulty") { showArenaMenu();   return; }
      if (currentScreen === "online-lobby") { disconnectOnline(); showModeMenu(); return; }
      if (currentScreen === "multiplayer" || currentScreen === "online-join") { showModeMenu(); return; }
      if (currentScreen === "settings" || currentScreen === "stats" || currentScreen === "store" || currentScreen === "mode") { showMainMenu(); }
    }

    addListener(document, "keydown", (e) => {
      pongAudio.primeFromGesture();
      const code = e.code || "";

      if ((e.key === "q" || e.key === "Q") && currentScreen === "game") {
        e.preventDefault();
        heat = HEAT_MAX;
        if (!bossModeActive && !bossTriggeredThisRally && !preBossActive) triggerPreBoss();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (rebindingTarget) { rebindingTarget = null; rebuildControlsPane && rebuildControlsPane(); return; }
        if (progScreen === "levelUp")      { progScreen = null; processPendingLevelUps(); return; }
        if (progScreen === "matchSummary") { progScreen = null; return; }
        if (progScreen === "perkSelect")   { return; }
        handleEscapeAction();
        return;
      }

      // ── Rebind capture ──────────────────────────────────────────────────
      if (rebindingTarget) {
        e.preventDefault();
        const reserved = ["Escape","KeyR","KeyQ","Enter"];
        if (!reserved.includes(code)) {
          keyBindings[rebindingTarget] = code;
          saveKeyBindings();
          rebindingTarget = null;
          rebuildControlsPane && rebuildControlsPane();
        }
        return;
      }

      // ── Progression screen input ────────────────────────────────────────
      if (progScreen === "perkSelect") {
        e.preventDefault();
        if (e.key === "1") { progSelectedPerk = 0; return; }
        if (e.key === "2") { progSelectedPerk = Math.min(1, progPerkOptions.length - 1); return; }
        if (e.key === "3") { progSelectedPerk = Math.min(2, progPerkOptions.length - 1); return; }
        if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") { progSelectedPerk = Math.max(0, progSelectedPerk - 1); return; }
        if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { progSelectedPerk = Math.min(progPerkOptions.length - 1, progSelectedPerk + 1); return; }
        if (e.key === "Enter" || e.key === " ") {
          const chosen = progPerkOptions[progSelectedPerk];
          if (chosen) GlitchProgression.equipPerk(chosen.id);
          progScreen = null; processPendingLevelUps(); return;
        }
        return;
      }
      if (progScreen === "levelUp") {
        if (e.key === "Enter" || e.key === " " || e.key === "r" || e.key === "R") { progScreen = null; processPendingLevelUps(); return; }
        return;
      }
      if (progScreen === "matchSummary") {
        e.preventDefault();
        if (e.key === "Enter" || e.key === " ") { progScreen = null; processPendingLevelUps(); return; }
        if (e.key === "r" || e.key === "R") { progScreen = null; returnToMainMenu(); return; }
        return;
      }

      if (currentScreen !== "game" || isPaused) return;

      if (onlineState.active) {
        if (code === keyBindings.p1Up) onlineSendInput("up");
        if (code === keyBindings.p1Down) onlineSendInput("down");
        return;
      }

      // Key bindings
      if (code === keyBindings.p1Up)   keys.w = true;
      if (code === keyBindings.p1Down) keys.s = true;
      if (code === keyBindings.p1Dash) keys.shiftLeft = true;
      if (code === keyBindings.p2Up)   keys.up = true;
      if (code === keyBindings.p2Down) keys.down = true;
      if (code === keyBindings.p2Dash) keys.shiftRight = true;

      if (!e.repeat && !aiVsAiMode) {
        if ((code === keyBindings.p1Up   && keys.shiftLeft)  || (code === keyBindings.p1Dash && keys.w)) performPaddleDash("left",  -1);
        if ((code === keyBindings.p1Down && keys.shiftLeft)  || (code === keyBindings.p1Dash && keys.s)) performPaddleDash("left",   1);
        if (twoPlayerMode && ((code === keyBindings.p2Up   && keys.shiftRight) || (code === keyBindings.p2Dash && keys.up)))   performPaddleDash("right", -1);
        if (twoPlayerMode && ((code === keyBindings.p2Down && keys.shiftRight) || (code === keyBindings.p2Dash && keys.down))) performPaddleDash("right",  1);
      }

      if (e.key === "r" || e.key === "R") {
        if (gameOver) {
          if (progScreen === "matchSummary") { progScreen = null; }
          returnToMainMenu();
        }
      }
    }, true);

    addListener(document, "keyup", (e) => {
      const code = e.code || "";
      if (onlineState.active && currentScreen === "game" && (code === keyBindings.p1Up || code === keyBindings.p1Down)) {
        onlineSendInput("stop");
        return;
      }
      // Always clear standard defaults
      if (e.key === "w" || e.key === "W") keys.w = false;
      if (e.key === "s" || e.key === "S") keys.s = false;
      if (e.key === "ArrowUp")   keys.up = false;
      if (e.key === "ArrowDown") keys.down = false;
      if (code === "ShiftLeft")  keys.shiftLeft = false;
      if (code === "ShiftRight") keys.shiftRight = false;
      // Custom bindings
      if (code === keyBindings.p1Up)   keys.w = false;
      if (code === keyBindings.p1Down) keys.s = false;
      if (code === keyBindings.p1Dash) keys.shiftLeft = false;
      if (code === keyBindings.p2Up)   keys.up = false;
      if (code === keyBindings.p2Down) keys.down = false;
      if (code === keyBindings.p2Dash) keys.shiftRight = false;
    }, true);

    // ── TOUCH CONTROLS: PLAYER 1 (left/blue paddle) ──────────────────────────
    // Activate pointer events so the canvas receives touch input.
    overlay.style.pointerEvents = "auto";
    canvas.style.pointerEvents = "auto";

    // Touch zone: left 48% of screen width = P1 control area.
    const P1_ZONE_X = 0.48;
    const P2_ZONE_X = 0.52;
    // Swipe-to-dash: 55 px vertical in under 260 ms.
    const SWIPE_DIST = 55;
    const SWIPE_MS   = 260;

    let p1Touch = null; // tracks the active P1 finger
    let p2Touch = null; // tracks the active P2 finger in local multiplayer

    // Create a subtle visual touch-zone hint that fades in when the game starts.
    const p1HintEl = document.createElement("div");
    p1HintEl.style.cssText = [
      "position:absolute",
      "left:0","top:0",
      "width:" + Math.round(P1_ZONE_X * 100) + "%",
      "height:100%",
      "pointer-events:none",
      "border-right:1px solid rgba(0,255,255,0.08)",
      "background:linear-gradient(90deg,rgba(0,200,255,0.04) 0%,transparent 100%)",
      "opacity:0",
      "transition:opacity 0.6s ease",
      "z-index:1"
    ].join(";");
    overlay.appendChild(p1HintEl);

    // Show the hint when game mode is selected (1P game starts).
    let p1HintVisible = false;
    function showP1Hint() {
      if (p1HintVisible) return;
      p1HintVisible = true;
      p1HintEl.style.opacity = "1";
      // Fade hint out after 3 s so it's not distracting during play.
      setTimeout(() => { p1HintEl.style.opacity = "0"; }, 3000);
    }

    // Poll via RAF: show hint once game screen becomes active.
    let p1HintShown = false;
    function watchForGameScreen() {
      if (!p1HintShown && currentScreen === "game" && modeSelected) {
        p1HintShown = true;
        showP1Hint();
      }
      requestAnimationFrame(watchForGameScreen);
    }
    requestAnimationFrame(watchForGameScreen);

    // ── Touch helpers ──
    function p1Dir(clientY) {
      // Upper half → move up (-1); lower half → move down (+1)
      return clientY < canvas.height * 0.5 ? -1 : 1;
    }

    function applyP1Dir(dir) {
      keys.w = dir < 0;
      keys.s = dir > 0;
    }

    function applyP2Dir(dir) {
      keys.up = dir < 0;
      keys.down = dir > 0;
    }

    // ── touchstart ──
    addListener(canvas, "touchstart", function(e) {
      pongAudio.primeFromGesture();
      if (currentScreen !== "game" || isPaused) return;

      // Progression overlays need real touch controls; keyboard-only prompts
      // left mobile players trapped on the match summary and level-up screens.
      if (isMobileDevice && progScreen && e.changedTouches.length) {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const tx = (touch.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
        const ty = (touch.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
        e.preventDefault();

        if (progScreen === "matchSummary") {
          if (ty < canvas.height - 76) return;
          if (tx < canvas.width / 2) {
            progScreen = null;
            returnToMainMenu();
          } else {
            progScreen = null;
            processPendingLevelUps();
          }
          return;
        }

        if (progScreen === "levelUp") {
          progScreen = null;
          processPendingLevelUps();
          return;
        }

        if (progScreen === "perkSelect") {
          const cardW = Math.min(260, (canvas.width - 80) / 3);
          const cardH = Math.max(118, Math.min(160, canvas.height - 158));
          const gap = 8;
          const totalW = cardW * 3 + gap * 2;
          const startX = canvas.width / 2 - totalW / 2;
          const cardY = 112;
          if (ty >= cardY && ty <= cardY + cardH) {
            const index = Math.floor((tx - startX) / (cardW + gap));
            const cardX = startX + index * (cardW + gap);
            if (index >= 0 && index < progPerkOptions.length && tx >= cardX && tx <= cardX + cardW) {
              const chosen = progPerkOptions[index];
              if (chosen) GlitchProgression.equipPerk(chosen.id);
              progSelectedPerk = index;
              progScreen = null;
              processPendingLevelUps();
            }
          }
          return;
        }
      }

      if (isMobileDevice && gameOver) {
        e.preventDefault();
        returnToMainMenu();
        return;
      }

      if (gameOver || aiVsAiMode) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX < canvas.width * P1_ZONE_X && !p1Touch) {
          e.preventDefault();
          p1Touch = {
            id: t.identifier,
            startY: t.clientY,
            startTime: Date.now()
          };
          applyP1Dir(p1Dir(t.clientY));
        } else if (twoPlayerMode && t.clientX > canvas.width * P2_ZONE_X && !p2Touch) {
          e.preventDefault();
          p2Touch = {
            id: t.identifier,
            startY: t.clientY,
            startTime: Date.now()
          };
          applyP2Dir(p1Dir(t.clientY));
        }
      }
    }, { capture: true, passive: false });

    // ── touchmove ──
    addListener(canvas, "touchmove", function(e) {
      if ((!p1Touch && !p2Touch) || currentScreen !== "game" || isPaused || gameOver || aiVsAiMode) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (p1Touch && t.identifier === p1Touch.id) {
          e.preventDefault();
          applyP1Dir(p1Dir(t.clientY));
          const dy = t.clientY - p1Touch.startY;
          const dt = Date.now() - p1Touch.startTime;
          if (Math.abs(dy) >= SWIPE_DIST && dt <= SWIPE_MS && leftDashCooldown === 0) {
            performPaddleDash("left", dy < 0 ? -1 : 1);
            p1Touch.startY = t.clientY;
            p1Touch.startTime = Date.now();
          }
        } else if (p2Touch && t.identifier === p2Touch.id) {
          e.preventDefault();
          applyP2Dir(p1Dir(t.clientY));
          const dy = t.clientY - p2Touch.startY;
          const dt = Date.now() - p2Touch.startTime;
          if (Math.abs(dy) >= SWIPE_DIST && dt <= SWIPE_MS && rightDashCooldown === 0) {
            performPaddleDash("right", dy < 0 ? -1 : 1);
            p2Touch.startY = t.clientY;
            p2Touch.startTime = Date.now();
          }
        }
      }
    }, { capture: true, passive: false });

    // ── touchend / touchcancel ──
    function p1TouchRelease(e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const id = e.changedTouches[i].identifier;
        if (p1Touch && id === p1Touch.id) {
          keys.w = false;
          keys.s = false;
          p1Touch = null;
        }
        if (p2Touch && id === p2Touch.id) {
          keys.up = false;
          keys.down = false;
          p2Touch = null;
        }
      }
    }
    addListener(canvas, "touchend",    p1TouchRelease, { capture: true, passive: true });
    addListener(canvas, "touchcancel", p1TouchRelease, { capture: true, passive: true });

    // Also release P1 touch state when player hits Escape to pause.
    addListener(document, "keydown", (e) => {
      if (e.key === "Escape" && currentScreen === "game") {
        keys.w = false; keys.s = false; keys.up = false; keys.down = false;
        p1Touch = null; p2Touch = null;
      }
    }, true);

    // Portrait-mode overlay inside the game canvas (shown when device is rotated wrong).
    const portraitWarnEl = document.createElement("div");
    portraitWarnEl.style.cssText = [
      "position:absolute","inset:0","z-index:9999",
      "background:#05060d",
      "display:none",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "gap:20px",
      "color:#71efff",
      "font-family:monospace",
      "font-size:18px",
      "letter-spacing:3px",
      "text-align:center",
      "padding:32px",
      "pointer-events:none"
    ].join(";");
    portraitWarnEl.innerHTML = [
      "<div style='font-size:52px'>&#8635;</div>",
      "<div style='font-family:VT323,monospace;font-size:36px;color:#71efff;letter-spacing:4px'>ROTATE DEVICE</div>",
      "<div style='font-size:12px;color:#8fb1c9;letter-spacing:2px'>GLITCH PONG REQUIRES LANDSCAPE</div>"
    ].join("");
    overlay.appendChild(portraitWarnEl);

    function checkOrientation() {
      const isPortrait = window.innerHeight > window.innerWidth;
      portraitWarnEl.style.display = isPortrait ? "flex" : "none";
    }
    checkOrientation();
    addListener(window, "resize", checkOrientation, true);
    addListener(window, "orientationchange", checkOrientation, true);

    refreshPauseAudioIndicators();
    showMainMenu();
    resetPositions();
    loop();
  }


  function startBreakout() {
    const shell = installBaseShell("DOM BREAKOUT", "DOM BREAKOUT // Mouse or ← →");
    const { d, w, canvas, ctx, updateHUD: setHud, state, addListener } = shell;

    const originalImageStyles = [];
    let paddle = { w: 160, h: 14, x: 0, y: 0 };
    let ball = { x: 0, y: 0, r: 10, vx: 0, vy: 0, speed: 7.8 };
    let game = {
      score: 0,
      lives: 3,
      running: true,
      bricks: [],
      keys: { left:false, right:false },
      mouseX:null,
      message:"PRESS SPACE BAR TO LAUNCH BALL",
      glitchTick:0,
      sweepPhase:0,
      launched:false,
      wave:1,
      safetyBackdrop:false
    };

    const GRID_ROWS = 6;
    const GRID_COLS = 12;
    const GRID_TOTAL = GRID_ROWS * GRID_COLS;

    function safeRoundRect(x, y, w, h, r) {
      const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    function colorForRow(row, maxRow) {
      const rowRatio = maxRow <= 0 ? 0 : row / maxRow;
      return 8 + rowRatio * 205;
    }

    function makeFallbackBrick(idx) {
      return {
        image: null,
        fallback: true,
        x:0, y:0, w:0, h:0,
        destroyed:false,
        flash:0,
        row:0,
        colorHue: 0,
        idx
      };
    }

    function collectImageBricks() {
      const sourceImages = Array.from(d.images)
        .filter((img) => {
          if (!img || !img.getBoundingClientRect) return false;
          const cs = w.getComputedStyle(img);
          if (cs.display === "none" || cs.visibility === "hidden") return false;
          const r = img.getBoundingClientRect();
          const naturalW = img.naturalWidth || r.width || 0;
          const naturalH = img.naturalHeight || r.height || 0;
          if (naturalW < 24 || naturalH < 20) return false;
          return !!(img.currentSrc || img.src);
        });

      sourceImages.forEach((img) => {
        originalImageStyles.push({
          el: img,
          opacity: img.style.opacity,
          filter: img.style.filter,
          outline: img.style.outline,
          transition: img.style.transition
        });
        img.style.transition = "opacity .18s ease, filter .18s ease";
        img.style.opacity = "0.03";
        img.style.filter = "grayscale(0.45) brightness(0.42) saturate(0.72)";
        img.style.outline = "1px solid rgba(86,224,255,0.04)";
      });

      const bricks = [];
      game.safetyBackdrop = safetyMode && sourceImages.length < GRID_TOTAL;

      if (sourceImages.length >= GRID_TOTAL) {
        for (let i = 0; i < GRID_TOTAL; i += 1) {
          bricks.push({
            image: sourceImages[i],
            fallback: false,
            x:0, y:0, w:0, h:0,
            destroyed:false,
            flash:0,
            row:0,
            colorHue:0,
            idx:i
          });
        }
      } else if (sourceImages.length > 0 && !safetyMode) {
        for (let i = 0; i < GRID_TOTAL; i += 1) {
          bricks.push({
            image: sourceImages[i % sourceImages.length],
            fallback: false,
            x:0, y:0, w:0, h:0,
            destroyed:false,
            flash:0,
            row:0,
            colorHue:0,
            idx:i
          });
        }
      } else {
        for (let i = 0; i < Math.min(sourceImages.length, GRID_TOTAL); i += 1) {
          bricks.push({
            image: sourceImages[i],
            fallback: false,
            x:0, y:0, w:0, h:0,
            destroyed:false,
            flash:0,
            row:0,
            colorHue:0,
            idx:i
          });
        }
        while (bricks.length < GRID_TOTAL) {
          bricks.push(makeFallbackBrick(bricks.length));
        }
      }

      return bricks;
    }

    function layoutBricks() {
      const live = game.bricks.filter((b) => !b.destroyed);

      const sidePadding = 10;
      const gapX = 4;
      const gapY = 6;
      const hudBottomSafe = 118;
      const topOffset = hudBottomSafe;
      const usableWidth = canvas.width - sidePadding * 2;

      const brickW = Math.floor((usableWidth - gapX * (GRID_COLS - 1)) / GRID_COLS);
      const brickH = Math.max(22, Math.min(34, Math.floor(brickW * 0.46)));

      const totalRowWidth = brickW * GRID_COLS + gapX * (GRID_COLS - 1);
      const startX = Math.max(8, Math.floor((canvas.width - totalRowWidth) / 2));

      const maxRow = GRID_ROWS - 1;
      live.forEach((b, i) => {
        const row = Math.floor(i / GRID_COLS);
        const col = i % GRID_COLS;
        b.row = row;
        b.w = brickW;
        b.h = brickH;
        b.x = startX + col * (brickW + gapX);
        b.y = topOffset + row * (brickH + gapY);
        b.colorHue = colorForRow(row, maxRow);
      });
    }

    function resetPaddle() {
      paddle.x = (canvas.width - paddle.w) / 2;
      paddle.y = canvas.height - 58;
    }

    function resetBall() {
      game.launched = false;
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 2;
      ball.vx = 0;
      ball.vy = 0;
    }

    function launchBall() {
      if (game.launched || !game.running) return;
      game.launched = true;
      const angle = (Math.random() * 1.0) - 0.5;
      const direction = Math.random() > 0.5 ? 1 : -1;
      ball.vx = Math.sin(angle) * ball.speed * direction;
      ball.vy = -Math.cos(angle) * ball.speed;
      if (Math.abs(ball.vx) < 2.2) ball.vx = (ball.vx < 0 ? -1 : 1) * 2.6;
      game.message = `WAVE ${game.wave} LIVE`;
    }

    function remainingBricks() {
      return game.bricks.filter((b) => !b.destroyed).length;
    }

    function drawBackdrop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      if (game.safetyBackdrop) {
        bg.addColorStop(0, "rgba(2,4,8,0.86)");
        bg.addColorStop(1, "rgba(0,0,0,0.92)");
      } else {
        bg.addColorStop(0, "rgba(16,18,24,0.28)");
        bg.addColorStop(1, "rgba(6,8,14,0.48)");
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const vignette = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.55, 60, canvas.width / 2, canvas.height * 0.55, canvas.width * 0.7);
      vignette.addColorStop(0, "rgba(255,255,255,0.00)");
      vignette.addColorStop(1, game.safetyBackdrop ? "rgba(0,0,0,0.34)" : "rgba(0,0,0,0.18)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < canvas.height; y += 5) {
        ctx.fillStyle = y % 10 === 0 ? "rgba(255,255,255,0.016)" : "rgba(255,255,255,0.010)";
        ctx.fillRect(0, y, canvas.width, 1);
      }

      if (game.glitchTick % 180 < 7) {
        const glitchY = 100 + ((game.glitchTick * 13) % Math.max(40, canvas.height - 220));
        ctx.fillStyle = "rgba(86,224,255,0.06)";
        ctx.fillRect(0, glitchY, canvas.width, 3);
        ctx.fillStyle = "rgba(255,79,216,0.04)";
        ctx.fillRect(0, glitchY + 4, canvas.width, 2);
      }

      game.sweepPhase += 0.012;
      const sweepX = (Math.sin(game.sweepPhase) * 0.5 + 0.5) * canvas.width;
      const sweep = ctx.createLinearGradient(sweepX - 180, 0, sweepX + 180, 0);
      sweep.addColorStop(0, "rgba(255,255,255,0)");
      sweep.addColorStop(0.45, "rgba(86,224,255,0.015)");
      sweep.addColorStop(0.55, "rgba(255,79,216,0.018)");
      sweep.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawFallbackPattern(brick) {
      const hue = brick.colorHue;
      const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
      grad.addColorStop(0, `hsla(${hue}, 90%, 58%, 0.85)`);
      grad.addColorStop(0.55, `hsla(${hue + 18}, 85%, 46%, 0.70)`);
      grad.addColorStop(1, "rgba(8,12,20,0.72)");
      ctx.fillStyle = grad;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);

      for (let y = brick.y + 2; y < brick.y + brick.h; y += 5) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(brick.x, y, brick.w, 1);
      }

      const miniW = Math.max(8, Math.floor(brick.w * 0.17));
      const miniH = Math.max(4, Math.floor(brick.h * 0.18));
      const miniGap = 3;
      const cols = 4;
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = brick.x + 6 + col * (miniW + miniGap);
          const y = brick.y + 7 + row * (miniH + miniGap);
          ctx.fillStyle = `hsla(${hue + row * 10 + col * 4}, 96%, ${58 - row * 5}%, 0.88)`;
          ctx.fillRect(x, y, miniW, miniH);
        }
      }
    }

    function drawBrick(brick) {
      if (brick.destroyed) return;

      const radius = 6;
      ctx.save();
      safeRoundRect(brick.x, brick.y, brick.w, brick.h, radius);
      ctx.clip();

      if (brick.fallback || !brick.image) {
        drawFallbackPattern(brick);
      } else {
        try {
          ctx.drawImage(brick.image, brick.x, brick.y, brick.w, brick.h);
        } catch {
          drawFallbackPattern(brick);
        }

        const tint = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
        tint.addColorStop(0, `hsla(${brick.colorHue}, 95%, 60%, 0.30)`);
        tint.addColorStop(0.45, `hsla(${brick.colorHue + 18}, 85%, 50%, 0.10)`);
        tint.addColorStop(1, "rgba(8,12,20,0.22)");
        ctx.fillStyle = tint;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      }

      for (let y = brick.y + 2; y < brick.y + brick.h; y += 6) {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(brick.x, y, brick.w, 1);
      }

      if ((game.glitchTick + brick.idx * 5) % 240 < 3) {
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(brick.x, brick.y + brick.h * 0.35, brick.w, 2);
        ctx.fillStyle = "rgba(255,79,216,0.08)";
        ctx.fillRect(brick.x, brick.y + brick.h * 0.35 + 3, brick.w * 0.78, 2);
      }

      if (brick.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${brick.flash / 10})`;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        brick.flash -= 1;
      }

      ctx.restore();

      ctx.strokeStyle = `hsla(${brick.colorHue + 8}, 92%, 70%, 0.38)`;
      ctx.lineWidth = 1.1;
      safeRoundRect(brick.x, brick.y, brick.w, brick.h, radius);
      ctx.stroke();
    }

    function drawBricks() {
      game.bricks.forEach(drawBrick);
    }

    function drawPaddle() {
      const px = paddle.x;
      const py = paddle.y;
      const grad = ctx.createLinearGradient(px, py, px, py + paddle.h);
      grad.addColorStop(0, "#1aa6ff");
      grad.addColorStop(1, "#0b73d2");
      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(26,166,255,0.22)";
      ctx.shadowBlur = 18;
      safeRoundRect(px, py, paddle.w, paddle.h, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "rgba(255,255,255,0.16)";
      safeRoundRect(px + 6, py + 3, paddle.w - 12, 4, 3);
      ctx.fill();

      if (game.glitchTick % 150 < 3) {
        ctx.fillStyle = "rgba(255,79,216,0.16)";
        ctx.fillRect(px + 14, py + 2, paddle.w * 0.42, 2);
      }
    }

    function drawBall() {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = "#f3f3f3";
      ctx.shadowColor = "rgba(255,255,255,0.42)";
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (game.glitchTick % 90 < 4) {
        ctx.beginPath();
        ctx.arc(ball.x + 3, ball.y, ball.r * 0.92, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,79,216,0.10)";
        ctx.fill();
      }
    }

    function drawFrame() {
      ctx.strokeStyle = "rgba(86,224,255,0.10)";
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
    }

    function flashBrick(brick) {
      brick.flash = 8;
    }

    function renderHud() {
      setHud(
        `DOM BREAKOUT // SCORE: <span style="color:#7ef9ff">${game.score}</span> // LIVES: <span style="color:#ffd166">${game.lives}</span> // WAVE: <span style="color:#9ee7ff">${game.wave}</span> // BLOCKS: <span style="color:#ff8fab">${remainingBricks()}</span> // ${game.message}`
      );
    }

    function restoreImages() {
      originalImageStyles.forEach((item) => {
        if (!item.el || !item.el.style) return;
        item.el.style.opacity = item.opacity || "";
        item.el.style.filter = item.filter || "";
        item.el.style.outline = item.outline || "";
        item.el.style.transition = item.transition || "";
      });
    }

    function restart() {
      restoreImages();
      game.score = 0;
      game.lives = 3;
      game.wave = 1;
      game.running = true;
      game.launched = false;
      game.message = "PRESS SPACE BAR TO LAUNCH BALL";
      game.bricks = collectImageBricks();
      layoutBricks();
      resetPaddle();
      resetBall();
    }

    function loadNextWave() {
      restoreImages();
      game.wave += 1;
      game.running = true;
      game.launched = false;
      game.message = "WAVE CLEARED // PRESS SPACE BAR TO LAUNCH";
      game.bricks = collectImageBricks();
      layoutBricks();
      resetPaddle();
      resetBall();
    }

    function collideBrick(brick) {
      return (
        ball.x + ball.r > brick.x &&
        ball.x - ball.r < brick.x + brick.w &&
        ball.y + ball.r > brick.y &&
        ball.y - ball.r < brick.y + brick.h
      );
    }

    function step() {
      game.glitchTick += 1;

      if (game.mouseX != null) {
        paddle.x = clamp(game.mouseX - paddle.w / 2, 16, canvas.width - paddle.w - 16);
      } else {
        if (game.keys.left) paddle.x -= 10;
        if (game.keys.right) paddle.x += 10;
        paddle.x = clamp(paddle.x, 16, canvas.width - paddle.w - 16);
      }

      if (!game.launched) {
        ball.x = paddle.x + paddle.w / 2;
        ball.y = paddle.y - ball.r - 2;
      }

      if (game.running && game.launched) {
        ball.x += ball.vx;
        ball.y += ball.vy;

        if (ball.x - ball.r <= 0) {
          ball.x = ball.r;
          ball.vx *= -1;
        }
        if (ball.x + ball.r >= canvas.width) {
          ball.x = canvas.width - ball.r;
          ball.vx *= -1;
        }
        if (ball.y - ball.r <= 0) {
          ball.y = ball.r;
          ball.vy *= -1;
        }

        if (ball.y - ball.r > canvas.height) {
          game.lives -= 1;
          game.message = "SIGNAL LOST // PRESS SPACE BAR TO LAUNCH";
          if (game.lives <= 0) {
            game.running = false;
            game.launched = false;
            game.message = "GAME OVER // PRESS R";
          } else {
            resetPaddle();
            resetBall();
          }
        }

        if (ball.y + ball.r >= paddle.y && ball.x >= paddle.x && ball.x <= paddle.x + paddle.w && ball.vy > 0) {
          const impact = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
          ball.vx = impact * 8.2;
          ball.vy = -Math.abs(ball.vy);
          ball.y = paddle.y - ball.r - 1;
          game.message = `WAVE ${game.wave} LIVE`;
        }

        for (const brick of game.bricks) {
          if (brick.destroyed) continue;
          if (collideBrick(brick)) {
            brick.destroyed = true;
            flashBrick(brick);
            game.score += 50;
            ball.vy *= -1;
            game.message = "BRICK CORRUPTED";
            break;
          }
        }

        if (remainingBricks() === 0 && game.bricks.length) {
          loadNextWave();
        }
      }

      drawBackdrop();
      drawBricks();
      drawPaddle();
      drawBall();
      drawFrame();
      renderHud();

      state.raf = requestAnimationFrame(step);
    }

    const baseCleanup = window.__glitchcadeCleanup;
    window.__glitchcadeCleanup = function() {
      restoreImages();
      if (baseCleanup) baseCleanup();
    };

    addListener(document, "mousemove", (e) => {
      game.mouseX = e.clientX;
    }, true);

    addListener(document, "keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") game.keys.left = true;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") game.keys.right = true;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        launchBall();
      }
      if (e.key === "Escape") window.__glitchcadeCleanup && window.__glitchcadeCleanup();
      if (e.key === "r" || e.key === "R") restart();
    }, true);

    addListener(document, "keyup", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") game.keys.left = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") game.keys.right = false;
    }, true);

    restart();
    step();
  }


  function startInvaders() {
    const shell = installBaseShell("DOM SPACE INVADERS", "DOM INVADERS // ← → move // Space shoot");
    const { d, w, overlay, canvas, ctx, updateHUD, state, addListener } = shell;

    const sources = Array.from(d.querySelectorAll("img, svg, canvas, [role='img']"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 16 && r.height > 16;
      })
      .slice(0, 24);

    const invaders = [];
    const bullets = [];
    const enemyBullets = [];
    let score = 0;
    let lives = 3;
    let wave = 1;
    let moveDir = 1;
    let cooldown = 0;
    const player = { x: canvas.width / 2 - 25, y: canvas.height - 60, w: 50, h: 18 };
    const keys = { left:false, right:false, shoot:false };

    function buildInvaders() {
      invaders.length = 0;
      const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(Math.max(sources.length, 12)))));
      const brickW = 70;
      const brickH = 54;
      const gap = 14;
      const startX = Math.max(30, (canvas.width - ((brickW + gap) * cols - gap)) / 2);
      const rows = 4;
      let idx = 0;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const source = sources[idx % Math.max(sources.length, 1)];
          invaders.push({
            x: startX + col * (brickW + gap),
            y: 110 + row * (brickH + gap),
            w: brickW,
            h: brickH,
            source,
            alive: true,
            boss: false
          });
          idx += 1;
        }
      }
      if (invaders.length) {
        invaders[0].boss = true;
        invaders[0].w = 110;
        invaders[0].h = 82;
      }
    }

    function drawPlayer() {
      const grad = ctx.createLinearGradient(player.x, player.y, player.x, player.y + player.h);
      grad.addColorStop(0, "#7ef9ff");
      grad.addColorStop(1, "#42c9ff");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(player.x, player.y, player.w, player.h, 8);
      ctx.fill();
      ctx.fillRect(player.x + player.w / 2 - 4, player.y - 10, 8, 12);
    }

    function drawInvaders() {
      invaders.forEach((inv) => {
        if (!inv.alive) return;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(inv.x, inv.y, inv.w, inv.h, 10);
        ctx.clip();
        try {
          if (inv.source && inv.source.tagName === "IMG") ctx.drawImage(inv.source, inv.x, inv.y, inv.w, inv.h);
          else {
            ctx.fillStyle = inv.boss ? "rgba(255,79,216,0.28)" : "rgba(86,224,255,0.28)";
            ctx.fillRect(inv.x, inv.y, inv.w, inv.h);
          }
        } catch {
          ctx.fillStyle = inv.boss ? "rgba(255,79,216,0.28)" : "rgba(86,224,255,0.28)";
          ctx.fillRect(inv.x, inv.y, inv.w, inv.h);
        }
        ctx.fillStyle = inv.boss ? "rgba(255,79,216,0.18)" : "rgba(6,10,18,0.18)";
        ctx.fillRect(inv.x, inv.y, inv.w, inv.h);
        ctx.restore();
        ctx.strokeStyle = inv.boss ? "rgba(255,79,216,0.55)" : "rgba(126,249,255,0.36)";
        ctx.strokeRect(inv.x, inv.y, inv.w, inv.h);
      });
    }

    function drawProjectiles() {
      bullets.forEach((b) => {
        ctx.fillStyle = "#7ef9ff";
        ctx.fillRect(b.x, b.y, 4, 16);
      });
      enemyBullets.forEach((b) => {
        ctx.fillStyle = "#ff8fab";
        ctx.fillRect(b.x, b.y, 4, 14);
      });
    }

    function loop() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = "rgba(4,8,18,0.18)";
      ctx.fillRect(0,0,canvas.width,canvas.height);

      for (let y = 0; y < canvas.height; y += 6) {
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillRect(0, y, canvas.width, 1);
      }

      if (keys.left) player.x -= 8;
      if (keys.right) player.x += 8;
      player.x = clamp(player.x, 12, canvas.width - player.w - 12);

      if (keys.shoot && cooldown <= 0) {
        bullets.push({ x: player.x + player.w / 2 - 2, y: player.y - 14 });
        cooldown = 12;
      }
      if (cooldown > 0) cooldown -= 1;

      let edgeHit = false;
      invaders.forEach((inv) => {
        if (!inv.alive) return;
        inv.x += moveDir * (inv.boss ? 0.8 : 1.4);
        if (inv.x <= 10 || inv.x + inv.w >= canvas.width - 10) edgeHit = true;
      });
      if (edgeHit) {
        moveDir *= -1;
        invaders.forEach((inv) => { if (inv.alive) inv.y += 16; });
      }

      bullets.forEach((b) => b.y -= 10);
      enemyBullets.forEach((b) => b.y += 6);

      if (Math.random() < 0.04) {
        const shooters = invaders.filter((inv) => inv.alive);
        if (shooters.length) {
          const s = shooters[Math.floor(Math.random() * shooters.length)];
          enemyBullets.push({ x: s.x + s.w / 2, y: s.y + s.h });
        }
      }

      for (let i = bullets.length - 1; i >= 0; i -= 1) {
        const b = bullets[i];
        if (b.y < -20) { bullets.splice(i, 1); continue; }
        for (const inv of invaders) {
          if (!inv.alive) continue;
          if (b.x >= inv.x && b.x <= inv.x + inv.w && b.y >= inv.y && b.y <= inv.y + inv.h) {
            inv.alive = false;
            bullets.splice(i, 1);
            score += inv.boss ? 150 : 40;
            break;
          }
        }
      }

      for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
        const b = enemyBullets[i];
        if (b.y > canvas.height + 20) { enemyBullets.splice(i, 1); continue; }
        if (b.x >= player.x && b.x <= player.x + player.w && b.y >= player.y && b.y <= player.y + player.h) {
          enemyBullets.splice(i, 1);
          lives -= 1;
        }
      }

      if (lives <= 0) {
        updateHUD(`DOM INVADERS // GAME OVER // SCORE: <span style="color:#ff8fab">${score}</span>`);
      } else {
        const aliveCount = invaders.filter((inv) => inv.alive).length;
        if (aliveCount === 0) {
          wave += 1;
          score += 200;
          buildInvaders();
        }
        updateHUD(`DOM INVADERS // SCORE: <span style="color:#7ef9ff">${score}</span> // LIVES: <span style="color:#ffd166">${lives}</span> // WAVE: <span style="color:#ff8fab">${wave}</span>`);
        drawInvaders();
        drawProjectiles();
        drawPlayer();
        state.raf = requestAnimationFrame(loop);
      }
    }

    addListener(document, "keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
      if (e.key === " " || e.code === "Space") keys.shoot = true;
      if (e.key === "Escape") window.__glitchcadeCleanup && window.__glitchcadeCleanup();
      if (e.key === "r" || e.key === "R") {
        score = 0; lives = 3; wave = 1; bullets.length = 0; enemyBullets.length = 0; buildInvaders();
      }
    }, true);

    addListener(document, "keyup", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
      if (e.key === " " || e.code === "Space") keys.shoot = false;
    }, true);

    buildInvaders();
    loop();
  }

  function startSnake() {
    const shell = installBaseShell("DOM SNAKE", "DOM SNAKE // Arrow keys");
    const { d, canvas, ctx, updateHUD, state, addListener, addTimer } = shell;

    const points = Array.from(d.querySelectorAll("a, button, img, p, h1, h2, h3, li"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.max(20, Math.min(window.innerWidth - 20, r.left + r.width / 2)), y: Math.max(100, Math.min(window.innerHeight - 40, r.top + r.height / 2)) };
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    const cell = 22;
    let dir = { x: 1, y: 0 };
    let nextDir = { x: 1, y: 0 };
    let snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    let food = { x: 14, y: 10 };
    let score = 0;
    let dead = false;

    function gridW() { return Math.floor(canvas.width / cell); }
    function gridH() { return Math.floor(canvas.height / cell); }

    function placeFood() {
      if (points.length) {
        const p = points[Math.floor(Math.random() * points.length)];
        food = { x: Math.floor(p.x / cell), y: Math.floor(p.y / cell) };
      } else {
        food = { x: Math.floor(Math.random() * Math.max(8, gridW() - 2)), y: Math.floor(5 + Math.random() * Math.max(8, gridH() - 7)) };
      }
    }

    function draw() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = "rgba(4,8,18,0.18)";
      ctx.fillRect(0,0,canvas.width,canvas.height);

      for (let y = 0; y < canvas.height; y += 6) {
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillRect(0, y, canvas.width, 1);
      }

      ctx.fillStyle = "#ff8fab";
      ctx.fillRect(food.x * cell, food.y * cell, cell - 2, cell - 2);

      snake.forEach((part, index) => {
        ctx.fillStyle = index === 0 ? "#7ef9ff" : "#42c9ff";
        ctx.fillRect(part.x * cell, part.y * cell, cell - 2, cell - 2);
      });

      updateHUD(`DOM SNAKE // SCORE: <span style="color:#7ef9ff">${score}</span>${dead ? ' // <span style="color:#ff8fab">GAME OVER // PRESS R</span>' : ''}`);
    }

    function step() {
      if (dead) { draw(); return; }

      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      if (head.x < 0 || head.y < 4 || head.x >= gridW() || head.y >= gridH() ||
          snake.some((part) => part.x === head.x && part.y === head.y)) {
        dead = true;
        draw();
        return;
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        score += 10;
        placeFood();
      } else {
        snake.pop();
      }

      draw();
    }

    addListener(document, "keydown", (e) => {
      if (e.key === "ArrowUp" && dir.y !== 1) nextDir = { x: 0, y: -1 };
      if (e.key === "ArrowDown" && dir.y !== -1) nextDir = { x: 0, y: 1 };
      if (e.key === "ArrowLeft" && dir.x !== 1) nextDir = { x: -1, y: 0 };
      if (e.key === "ArrowRight" && dir.x !== -1) nextDir = { x: 1, y: 0 };
      if (e.key === "Escape") window.__glitchcadeCleanup && window.__glitchcadeCleanup();
      if (e.key === "r" || e.key === "R") {
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 };
        snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
        score = 0;
        dead = false;
        placeFood();
      }
    }, true);

    placeFood();
    draw();
    const interval = setInterval(step, 110);
    addTimer(interval);
    const baseCleanup = window.__glitchcadeCleanup;
    window.__glitchcadeCleanup = function() {
      clearInterval(interval);
      if (baseCleanup) baseCleanup();
    };
  }

  commonTransition().then(() => {
    if (gameId === "true-dom-pong") startPong(options);
    else if (gameId === "cursor-arena") startCursorArena();
    else if (gameId === "dodge-grid") startDodgeGrid();
    else if (gameId === "dom-breakout") startBreakout();
    else if (gameId === "dom-space-invaders") startInvaders();
    else if (gameId === "dom-snake") startSnake();
    else throw new Error(`Unknown Glitchcade game: ${gameId}`);
  });
}





(function initGlitchPongSite() {
  function bootGlitchPongSite() {
    if (window.__glitchcadeCleanup) return;
    injectGameById('true-dom-pong', {
      glitchFx: true,
      safetyMode: false,
      audioUserInitiated: true,
      introVoiceDelayMs: 3000,
      introVoiceStartAtMs: Date.now()
    });
  }

  function initLandingPage() {
    const landing = document.getElementById('gpLanding');
    if (!landing) {
      bootGlitchPongSite();
      return;
    }

    let started = false;
    function startFromLanding() {
      if (started) return;
      started = true;
      // Unlock audio immediately inside the user-gesture handler (iOS requires this).
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        window.__glitchPongAudioContext = ctx;
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        ctx.resume().catch(() => {});
      } catch (e) {}
      document.body.classList.add('game-starting');
      setTimeout(() => {
        landing.style.display = 'none';
        bootGlitchPongSite();
      }, 360);
    }

    document.querySelectorAll('#playNowTop, #playNowHero').forEach((button) => {
      button.addEventListener('click', startFromLanding);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLandingPage, { once: true });
  } else {
    initLandingPage();
  }
})();
