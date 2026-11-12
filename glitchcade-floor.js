// ═══════════════════════════════════════════════════════════════════════════
// GLITCHCADE FLOOR — everything on the arcade floor that isn't a finished game
//
//   · repairing cabinets 03–10 and their 30-second ROM fragments
//   · THE EYE taking over the ceiling TVs, with building-wide glitch events
//   · prizes that do something (the ball, the heat gauge, the golden marquee)
//   · the daily challenge board, high scores and rally replays on the TVs
//   · PRIZETRON's opinions, the mystery capsule, jukebox records
//   · the STAFF ONLY room and its eleventh cabinet
//   · glitch patrons, the air hockey table, photo mode
//
// glitchcade.js builds the world and hands this module a context object (see
// floorContext() there). State that outlives the session is in
// glitchcade-state.js.
// ═══════════════════════════════════════════════════════════════════════════
import {
  FRAGMENTS, CHIP_PRIZE, FRAGMENT_DAILY_CAP, TOTAL_CABINETS, REPAIRABLE_SLOTS,
  CAPSULE_COST, CAPSULE_TOYS, TRACK_PACKS, HOCKEY_WIN_COINS, HOCKEY_PAID_WINS_PER_DAY, HOCKEY_TARGET,
  GAUNTLET_REWARD,
  createFloorStore, repairCost, fragmentPayout, cappedPayout, insertScore, scoreBoard, onlineCount,
  dailyChallenge, dailyProgress, statSnapshot, capsuleOfDay, todayStr, hashStr, mulberry32, cleanInitials
} from './glitchcade-state.js?v=floor-1';
import { createFragmentPlayer } from './glitchcade-microgames.js?v=floor-1';

export function installFloor(ctx) {
  const {
    THREE, C, scene, camera, audio, Wallet, assets, player, colliders, cabinets, interactables,
    rayTargets, animated, worldLights, isTouch, reducedMotion, ROOM_W, ROOM_D, ROOM_H, COUNTER,
    STAFF_DOOR, PRIZES, makeCanvas, canvasTexture, chromaText, scanlines, sliceGlitch, neonMaterial
  } = ctx;
  const hx = ROOM_W / 2;
  const UP = new THREE.Vector3(0, 1, 0);
  const store = createFloorStore();
  const F = () => store.today();
  const $ = (id) => document.getElementById(id);
  const dyn = (obj) => { obj.userData.noBake = true; return obj; };
  const pad2 = (n) => String(n).padStart(2, '0');
  const tmp = new THREE.Vector3();

  // Glitch Pong's progression record (wins, streaks, longest rally...).
  function gpData() {
    try { if (typeof GlitchProgression !== 'undefined' && GlitchProgression.data) return GlitchProgression.data; } catch (e) {}
    try { return JSON.parse(localStorage.getItem('glitchPong_progression_v1')) || {}; } catch (e) { return {}; }
  }
  const stats = () => statSnapshot(Wallet.get(), gpData(), F());
  const owns = (prizeId) => Wallet.get().prizes.includes(prizeId);
  const playerName = () => F().initials || 'YOU';

  // Coins the floor pays out. Tracked so the daily challenge can tell them
  // apart from Breakpoint's.
  function pay(n) {
    if (!(n > 0)) return;
    F().floorEarned += n;
    store.save();
    Wallet.award(n);
    audio.coin();
    ctx.pulseCoinHud();
  }

  // ───────────────────────────────────────────────────────────────────────
  // DOM the floor owns
  // ───────────────────────────────────────────────────────────────────────
  const hud = $('gcHud');
  function el(tag, id, html = '', parent = hud) {
    const e = document.createElement(tag);
    e.id = id;
    e.innerHTML = html;
    parent.appendChild(e);
    return e;
  }
  const listEl = el('div', 'gcList', '<h3></h3><p></p><ul></ul><small></small>');
  const activityEl = el('div', 'gcActivity');
  const bannerEl = el('div', 'gcEyeBanner');
  bannerEl.setAttribute('role', 'status');
  const finderEl = el('div', 'gcViewfinder', '<i></i><i></i><i></i><i></i><b>PHOTO MODE</b>');
  const blackoutEl = el('div', 'gcBlackout', '', ctx.root);
  const photoBtn = el('button', 'gcPhotoBtn', 'PHOTO');
  photoBtn.type = 'button';
  photoBtn.className = 'gc-touch-only';
  const postcardEl = el('div', 'gcPostcard',
    '<div class="gp-card"><img alt="Your Glitchcade postcard"><div class="gp-row">' +
    '<a class="gm-btn sm" id="gcPostSave" download="glitchcade-postcard.png">Save</a>' +
    '<button class="gm-btn sm" id="gcPostShare" type="button">Share</button>' +
    '<button class="gm-btn sm" id="gcPostClose" type="button">Close</button></div></div>', document.body);

  // ───────────────────────────────────────────────────────────────────────
  // BUSY ACTIVITIES — one at a time: a menu, the table, photo mode, a fragment
  // ───────────────────────────────────────────────────────────────────────
  let busy = null;       // { kind, key, mouse, click, update, cancel, covers }
  function beginBusy(activity) {
    if (ctx.state !== 'explore') return false;
    ctx.setBusy(true);
    busy = activity;
    return true;
  }
  function endBusy() {
    const b = busy;
    busy = null;
    if (b && b.cancel) b.cancel();
    activityEl.classList.remove('on');
    ctx.setBusy(false);
  }
  function showActivity(html) {
    activityEl.innerHTML = html;
    activityEl.classList.add('on');
  }

  // ── A plain list menu (jukebox, record crate, the gauntlet) ──
  let list = null;
  function openList(spec) {
    if (!beginBusy({ kind: 'list', key: listKey, click: listPick, cancel: () => { listEl.classList.remove('on'); list = null; } })) return;
    list = { spec, index: 0, items: [] };
    renderList();
    listEl.classList.add('on');
  }
  function renderList() {
    const items = list.spec.items().concat([{ label: 'CLOSE', close: true }]);
    list.items = items;
    if (list.index >= items.length || items[list.index].disabled) list.index = Math.max(0, items.findIndex((it) => !it.disabled));
    listEl.querySelector('h3').textContent = list.spec.title;
    listEl.querySelector('p').textContent = typeof list.spec.sub === 'function' ? list.spec.sub() : list.spec.sub || '';
    listEl.querySelector('small').textContent = isTouch ? 'TAP TO CHOOSE' : 'W / S choose · E select · Q close';
    const ul = listEl.querySelector('ul');
    ul.innerHTML = '';
    items.forEach((it, i) => {
      const li = document.createElement('li');
      li.className = (i === list.index ? 'sel ' : '') + (it.disabled ? 'off ' : '') + (it.close ? 'close' : '');
      const label = document.createElement('span');
      label.textContent = it.label;
      li.appendChild(label);
      if (it.note) { const note = document.createElement('em'); note.textContent = it.note; li.appendChild(note); }
      li.addEventListener('click', () => { if (!list) return; list.index = i; listPick(); });
      ul.appendChild(li);
    });
    const sel = ul.querySelector('.sel');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  }
  function listMove(d) {
    const n = list.items.length;
    for (let k = 0; k < n; k++) {
      list.index = (list.index + d + n) % n;
      if (!list.items[list.index].disabled) break;
    }
    audio.hover();
    renderList();
  }
  function listPick() {
    if (!list) return;
    const it = list.items[list.index];
    if (!it || it.disabled) { audio.deny(); return; }
    if (it.close) { endBusy(); return; }
    if (it.stay) { it.pick(); if (list) renderList(); return; }
    endBusy();
    it.pick();
  }
  function listKey(e, down) {
    if (!down || !list) return;
    const c = e.code;
    if (c === 'KeyW' || c === 'ArrowUp') { e.preventDefault(); listMove(-1); }
    else if (c === 'KeyS' || c === 'ArrowDown') { e.preventDefault(); listMove(1); }
    else if (c === 'KeyE' || c === 'Enter' || c === 'Space') { e.preventDefault(); listPick(); }
    else if (c === 'KeyQ' || c === 'Backspace' || c === 'Escape' || c === 'Tab') { e.preventDefault(); endBusy(); }
  }

  // ───────────────────────────────────────────────────────────────────────
  // 1. REPAIR LOOP — bring dead cabinets online, play their ROM fragments
  // ───────────────────────────────────────────────────────────────────────
  const fragments = createFragmentPlayer({ audio, isTouch, reducedMotion });
  const deadCabs = cabinets.filter((c) => c.movable);
  const isRepaired = (cab) => F().repaired.includes(cab.slot);
  const chipReady = () => owns(CHIP_PRIZE) && !F().chipUsed;

  // One shared attract screen for every repaired cabinet (each tints it).
  const fragScreen = (() => {
    const W = 256, H = 192;
    const cv = makeCanvas(W, H);
    const c2 = cv.getContext('2d');
    const tex = canvasTexture(cv);
    let t = 0;
    const dot = { x: 60, y: 120, vx: 70, vy: 46 };
    function draw(dt) {
      t += dt;
      c2.fillStyle = '#04030a';
      c2.fillRect(0, 0, W, H);
      c2.strokeStyle = 'rgba(255,255,255,.5)';
      c2.lineWidth = 3;
      c2.strokeRect(8, 8, W - 16, H - 16);
      dot.x += dot.vx * dt; dot.y += dot.vy * dt;
      if (dot.x < 16 || dot.x > W - 22) dot.vx *= -1;
      if (dot.y < 92 || dot.y > H - 44) dot.vy *= -1;
      c2.fillStyle = '#ffffff';
      c2.fillRect(dot.x, dot.y, 7, 7);
      c2.textAlign = 'center';
      c2.textBaseline = 'middle';
      c2.font = '900 25px Orbitron, "Arial Black", sans-serif';
      chromaText(c2, 'ROM FRAGMENT', W / 2, 40, 2);
      c2.font = '18px "Share Tech Mono", monospace';
      c2.fillStyle = 'rgba(255,255,255,.85)';
      c2.fillText('RECOVERED · 30 SEC', W / 2, 70);
      if (Math.floor(t * 2) % 2) {
        c2.font = '900 19px Orbitron, "Arial Black", sans-serif';
        c2.fillText(isTouch ? 'TAP USE TO PLAY' : 'PRESS E TO PLAY', W / 2, H - 24);
      }
      scanlines(c2, W, H, 0.22, 3);
      if (Math.random() < 0.08) sliceGlitch(c2, W, H, Math.random, 2, 18);
      tex.needsUpdate = true;
    }
    draw(0);
    return { tex, draw };
  })();

  function applyRepairLook(cab) {
    const on = isRepaired(cab);
    cab.screenMaterial.map = on ? fragScreen.tex : ctx.soonTexture();
    cab.screenMaterial.needsUpdate = true;
    cab.fragment = on ? FRAGMENTS[cab.slot] : null;
    // the marquee and coin door stop saying COMING SOON
    if (!cab.offlineLook) cab.offlineLook = { marquee: cab.marquee.material.map, coin: cab.coin.material.map };
    if (on && !cab.onlineLook) {
      cab.onlineLook = {
        marquee: ctx.makeComingSoonMarquee(cab.accent, cab.slot, cab.title, `// ROM FRAGMENT — CABINET ${pad2(cab.slot)} //`),
        coin: ctx.makeCoinDoor('INSERT COIN', cab.accent)
      };
    }
    const look = on ? cab.onlineLook : cab.offlineLook;
    if (cab.marquee.material.map === look.marquee) return;
    cab.marquee.material.map = look.marquee;
    cab.marquee.material.needsUpdate = true;
    cab.coin.material.map = cab.coin.material.emissiveMap = look.coin;
    cab.coin.material.needsUpdate = true;
  }

  function bestFor(id) {
    const l = F().scores[id];
    return l && l.length ? l[0].s : 0;
  }

  function repair(cab, free) {
    const f = F();
    if (free) f.chipUsed = true;
    f.repaired.push(cab.slot);
    store.save();
    applyRepairLook(cab);
    audio.redeem();
    ctx.worldGlitch();
    sparks(cab);
    refreshOnline();
    const left = REPAIRABLE_SLOTS.length - f.repaired.length;
    ctx.toast(`CABINET ${pad2(cab.slot)} ONLINE: ${cab.title} — ROM FRAGMENT RECOVERED (${onlineCount(f)}/${TOTAL_CABINETS})`, 3600);
    ctx.setRobotPending(left
      ? `CABINET ${pad2(cab.slot)} IS BACK ONLINE. ${left} MACHINE${left > 1 ? 'S' : ''} STILL DARK. I KEEP COUNT.`
      : 'EVERY CABINET IN THE GLITCHCADE IS ONLINE. I HAVE NOT SEEN THAT SINCE 1989.');
  }

  // a puff of neon sparks off the cabinet when it boots
  const sparkPool = [];
  function sparks(cab) {
    for (let i = 0; i < 14; i++) {
      const m = dyn(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), neonMaterial(i % 2 ? C.amber : cab.accent, 1.4)));
      m.position.copy(cab.screenCenter);
      scene.add(m);
      sparkPool.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 2.4, 1 + Math.random() * 2.4, (Math.random() - 0.5) * 2.4).addScaledVector(cab.forward, 1.2), life: 0.7 + Math.random() * 0.5 });
    }
  }

  function playFragment(cab) {
    const def = { ...FRAGMENTS[cab.slot], slot: cab.slot, accent: cab.accent };
    ctx.beginLaunch(cab, () => {
      busy = { kind: 'fragment', covers: true, key: (e, down) => fragments.key(e, down) };
      fragments.open(def, {
        best: bestFor(def.id),
        initials: F().initials,
        onScore(score) {
          const f = F();
          f.fragmentsPlayed++;
          const paid = f.frag.paid[def.id] || 0;
          const want = fragmentPayout(score, def.target);
          const coins = cappedPayout(want, paid);
          if (coins > 0) { f.frag.paid[def.id] = paid + coins; pay(coins); }
          const ins = insertScore(f.scores[def.id], playerName(), score);
          f.scores[def.id] = ins.list;
          store.save();
          const entry = ins.rank >= 0 ? ins.list[ins.rank] : null;
          const board = scoreBoard(ins.list, def.target);
          return { coins, capped: want > 0 && coins === 0, board, entry, rank: entry ? board.indexOf(entry) : -1 };
        },
        onInitials(name, result) {
          const f = F();
          f.initials = cleanInitials(name);
          if (result && result.entry) result.entry.n = f.initials;
          store.save();
          return result;
        },
        onClose() {
          busy = null;
          ctx.onGameExit();
        }
      });
    });
  }

  deadCabs.forEach((cab) => {
    applyRepairLook(cab);
    cab.prompt = (key, w) => {
      const tag = `CABINET ${pad2(cab.slot)}`;
      if (isRepaired(cab)) {
        const paid = F().frag.paid[FRAGMENTS[cab.slot].id] || 0;
        return { title: `PLAY ${cab.title}`, sub: `${tag} // ROM FRAGMENT · BEST ${bestFor(FRAGMENTS[cab.slot].id)} · ◎ ${paid}/${FRAGMENT_DAILY_CAP} TODAY` };
      }
      if (chipReady()) return { title: 'INSTALL OVERCLOCK CHIP', sub: `${tag} // ${cab.title} — FREE REPAIR` };
      const cost = repairCost(F().repaired.length);
      if (w.coins >= cost) return { title: `REPAIR ${cab.title}`, sub: `${tag} // ◎ ${cost} COINS · YOU HAVE ${w.coins}` };
      return { soon: true, title: cab.title, sub: `${tag} // OFFLINE — REPAIR ◎ ${cost} · NEED ${cost - w.coins} MORE` };
    };
    cab.use = () => {
      if (isRepaired(cab)) { playFragment(cab); return true; }
      if (chipReady()) { repair(cab, true); return true; }
      const cost = repairCost(F().repaired.length);
      if (!Wallet.spend(cost)) {                  // can't afford it: the screen fizzles
        audio.comingSoon(cab.screenCenter);
        ctx.toast(`${cab.title} (CABINET ${pad2(cab.slot)}) IS OFFLINE — A REPAIR COSTS ◎ ${cost}, YOU NEED ${cost - Wallet.get().coins} MORE.`, 3200);
        const original = cab.screenMaterial.color.clone();
        let n = 0;
        const iv = setInterval(() => {
          cab.screenMaterial.color.setHSL(Math.random(), 1, 0.7);
          if (++n > 6) { clearInterval(iv); cab.screenMaterial.color.copy(original); }
        }, 70);
        return true;
      }
      ctx.pulseCoinHud();
      repair(cab, false);
      return true;
    };
  });

  function refreshOnline() {
    const txt = `${onlineCount(F())}/${TOTAL_CABINETS}`;
    const badge = $('gcOnline');
    if (badge) badge.textContent = txt;
    const menu = $('gmCabs');
    if (menu) menu.textContent = txt;
    ctx.redrawInfoBoard();
  }

  ctx.setInfoLines(() => {
    const f = F();
    const n = f.repaired.length;
    const prog = dailyState();
    return [
      ['> CABINET 01 .......... GLITCH PONG', C.green],
      ['> CABINET 02 .......... BREAKPOINT', C.green],
      [`> CABINETS 03–10 ...... ${n ? `${n} OF 8 REPAIRED` : 'OFFLINE — REPAIR THEM'}`, n === 8 ? C.green : C.amber],
      [`> DAILY GLITCH ........ ${f.daily.claimed ? 'CLAIMED' : prog.done ? 'CLAIM AT THE DOOR' : 'BOARD BY THE DOOR'}`, C.cyan],
      ['> THE EYE ............. WATCHING', C.pink]
    ];
  });

  // ───────────────────────────────────────────────────────────────────────
  // DAILY CHALLENGE BOARD — on the front wall, left of the door
  // ───────────────────────────────────────────────────────────────────────
  function dailyState() {
    const f = F();
    if (!f.daily.base) { f.daily.base = stats(); store.save(); }
    const ch = dailyChallenge(f.daily.date);
    return { ch, ...dailyProgress(ch, f.daily.base, stats()) };
  }

  const dailyBoard = (() => {
    const W = 768, H = 448;
    const cv = makeCanvas(W, H);
    const c2 = cv.getContext('2d');
    const tex = canvasTexture(cv);
    function draw() {
      const f = F();
      const st = dailyState();
      c2.fillStyle = '#05040c';
      c2.fillRect(0, 0, W, H);
      c2.strokeStyle = st.done ? C.green : C.amber;
      c2.lineWidth = 8;
      c2.strokeRect(6, 6, W - 12, H - 12);
      c2.textAlign = 'left';
      c2.textBaseline = 'middle';
      c2.font = '900 58px Orbitron, "Arial Black", sans-serif';
      chromaText(c2, 'DAILY GLITCH', 44, 62, 4, C.text, C.amber);
      c2.font = '24px "Share Tech Mono", monospace';
      c2.fillStyle = '#b9a6e8';
      c2.fillText(`${f.daily.date}  //  ONE CHALLENGE, BOTH GAMES`, 46, 116);
      st.parts.forEach((p, i) => {
        const y = 176 + i * 84;
        c2.font = '28px "Share Tech Mono", monospace';
        c2.fillStyle = p.done ? C.green : C.text;
        c2.fillText(`${p.done ? '[x]' : '[ ]'} ${p.label}`, 46, y);
        c2.fillStyle = 'rgba(255,255,255,.1)';
        c2.fillRect(46, y + 26, W - 220, 12);
        c2.fillStyle = p.done ? C.green : C.cyan;
        c2.fillRect(46, y + 26, (W - 220) * (p.have / p.goal), 12);
        c2.textAlign = 'right';
        c2.fillText(`${p.have}/${p.goal}`, W - 46, y + 30);
        c2.textAlign = 'left';
      });
      c2.font = '900 34px Orbitron, "Arial Black", sans-serif';
      c2.fillStyle = f.daily.claimed ? C.green : C.amber;
      const foot = f.daily.claimed ? 'CLAIMED ✓  NEW CHALLENGE TOMORROW'
        : st.done ? `COMPLETE — CLAIM ◎ ${st.ch.reward} HERE`
          : `REWARD ◎ ${st.ch.reward} COINS`;
      c2.fillText(foot, 46, H - 58);
      scanlines(c2, W, H, 0.18, 4);
      tex.needsUpdate = true;
    }
    const x = -5.4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.575), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    mesh.position.set(x, 1.95, -0.02);
    mesh.rotation.y = Math.PI;
    scene.add(mesh);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.84, 0.05, 0.05), neonMaterial(C.amber, 0.9));
    frame.position.set(x, 1.1, -0.04);
    scene.add(frame);
    ctx.addGlow(scene, new THREE.Color(C.amber), 3.2, 0.12, new THREE.Vector3(x, 1.95, -0.5));
    ctx.addFloorGlow(scene, new THREE.Color(C.amber), 2.6, 1.6, x, -1.0, 0.2);
    interactables.push({
      kind: 'daily', scale: 1.2,
      position: new THREE.Vector3(x, 0, 0), forward: new THREE.Vector3(0, 0, -1),
      screenCenter: new THREE.Vector3(x, 1.95, -0.02),
      prompt() {
        const st = dailyState();
        if (F().daily.claimed) return { key: '✓', title: 'DAILY GLITCH', sub: 'CLAIMED // NEW CHALLENGE TOMORROW' };
        if (st.done) return { title: `CLAIM ◎ ${st.ch.reward} COINS`, sub: 'DAILY GLITCH // COMPLETE' };
        const open = st.parts.filter((p) => !p.done).map((p) => `${p.label} ${p.have}/${p.goal}`).join(' · ');
        return { soon: true, title: 'DAILY GLITCH', sub: open };
      },
      use() {
        const f = F();
        const st = dailyState();
        if (f.daily.claimed) { ctx.toast('TODAY\'S DAILY GLITCH IS CLAIMED. A NEW ONE COMPILES AT MIDNIGHT.'); return true; }
        if (!st.done) { audio.deny(); ctx.toast(`DAILY GLITCH: ${st.parts.filter((p) => !p.done).map((p) => p.label).join(' + ')}`, 3600); return true; }
        f.daily.claimed = true;
        store.save();
        pay(st.ch.reward);
        audio.redeem();
        ctx.toast(`DAILY GLITCH COMPLETE: +${st.ch.reward} COINS`);
        ctx.setRobotPending(`DAILY GLITCH CLEARED. ${st.ch.reward} BONUS COINS, AS PROMISED. I AM A MACHINE OF MY WORD.`);
        draw();
        refreshOnline();
        return true;
      }
    });
    return { draw };
  })();

  // ───────────────────────────────────────────────────────────────────────
  // CEILING TV CHANNELS — high scores and the longest-rally replay
  // ───────────────────────────────────────────────────────────────────────
  const SCORE_TARGETS = { 'glitch-pong': 30, breakpoint: 8000 };

  function recordScore(id, score) {
    const f = F();
    const best = bestFor(id);
    if (!(score > best)) return false;         // one line per personal best
    f.scores[id] = insertScore(f.scores[id], playerName(), score).list;
    store.save();
    return true;
  }

  function scorePages() {
    const f = F();
    const pages = [
      { head: 'CABINET 01 // GLITCH PONG', sub: 'LONGEST RALLY', rows: scoreBoard(f.scores['glitch-pong'], SCORE_TARGETS['glitch-pong']) },
      { head: 'CABINET 02 // BREAKPOINT', sub: 'HIGH SCORE', rows: scoreBoard(f.scores.breakpoint, SCORE_TARGETS.breakpoint) }
    ];
    deadCabs.filter(isRepaired).sort((a, b) => a.slot - b.slot).forEach((cab) => {
      const fr = FRAGMENTS[cab.slot];
      pages.push({ head: `CABINET ${pad2(cab.slot)} // ${fr.title}`, sub: 'ROM FRAGMENT', rows: scoreBoard(f.scores[fr.id], fr.target) });
    });
    pages.push({
      head: 'AIR HOCKEY', sub: `FIRST TO ${HOCKEY_TARGET}`,
      rows: [{ n: playerName(), s: f.hockey.wins }, { n: 'P80', s: f.hockey.losses, house: true }].sort((a, b) => b.s - a.s),
      unit: ' WINS'
    });
    return pages;
  }

  const scoreFeed = (() => {
    const W = 384, H = 288;
    const cv = makeCanvas(W, H);
    const c2 = cv.getContext('2d');
    const tex = canvasTexture(cv);
    let t = 0, shown = -1;
    function draw(dt) {
      t += dt;
      const pages = scorePages();
      const i = Math.floor(t / 4.5) % pages.length;
      const flick = (t % 4.5) < 0.2;
      if (i === shown && !flick && Math.random() > 0.1) return;
      shown = i;
      const p = pages[i];
      c2.fillStyle = '#04030c';
      c2.fillRect(0, 0, W, H);
      c2.textAlign = 'center';
      c2.textBaseline = 'middle';
      c2.font = '900 30px Orbitron, "Arial Black", sans-serif';
      chromaText(c2, 'HIGH SCORES', W / 2, 30, 2, C.amber);
      c2.font = '700 19px Orbitron, sans-serif';
      c2.fillStyle = C.cyan;
      c2.fillText(p.head, W / 2, 68, W - 24);
      c2.font = '18px "Share Tech Mono", monospace';
      c2.fillStyle = '#b9a6e8';
      c2.fillText(p.sub, W / 2, 92);
      c2.font = '34px VT323, monospace';
      p.rows.forEach((r, k) => {
        const y = 128 + k * 30;
        c2.fillStyle = r.house ? '#8f86b0' : C.green;
        c2.textAlign = 'left';
        c2.fillText(`${k + 1}. ${r.n}`, 78, y);
        c2.textAlign = 'right';
        c2.fillText(`${r.s.toLocaleString('en-US')}${p.unit || ''}`, W - 78, y);
      });
      scanlines(c2, W, H, 0.2, 3);
      if (flick) sliceGlitch(c2, W, H, Math.random, 4, 30);
      tex.needsUpdate = true;
    }
    draw(0);
    return { tex, draw };
  })();

  // Replays the longest rally Glitch Pong has on tape: the ball meets each
  // paddle at the heights it really did.
  const replayFeed = (() => {
    const W = 384, H = 288;
    const cv = makeCanvas(W, H);
    const c2 = cv.getContext('2d');
    const tex = canvasTexture(cv);
    const TOP = 44, BOT = H - 16, LX = 30, RX = W - 30;
    const s = { i: 0, k: 0, hold: 0, ly: 0.5, ry: 0.5, trail: [] };
    const tape = () => (window.GlitchRallyTape && window.GlitchRallyTape.best) || { n: 0, hits: [] };
    const yOf = (pct) => TOP + (BOT - TOP) * (pct / 100);
    function draw(dt) {
      const tp = tape();
      const n = tp.hits.length / 2;
      c2.fillStyle = '#04030c';
      c2.fillRect(0, 0, W, H);
      c2.textAlign = 'center';
      c2.textBaseline = 'middle';
      c2.font = '700 18px Orbitron, sans-serif';
      c2.fillStyle = C.pink;
      c2.fillText('▶ REPLAY // LONGEST RALLY', W / 2, 20);
      if (n < 4) {
        c2.font = '22px "Share Tech Mono", monospace';
        c2.fillStyle = '#b9a6e8';
        c2.fillText('NO RALLY ON TAPE YET', W / 2, H / 2 - 12);
        c2.fillText('PLAY GLITCH PONG', W / 2, H / 2 + 18);
        scanlines(c2, W, H, 0.2, 3);
        tex.needsUpdate = true;
        return;
      }
      if (s.i >= n - 1) {           // the rally's over: hold on the count, then rewind
        s.hold += dt;
        if (s.hold > 2.4) { s.i = 0; s.k = 0; s.hold = 0; s.trail.length = 0; }
      } else {
        s.k += dt / Math.max(0.28, 0.6 - s.i * 0.004);
        while (s.k >= 1 && s.i < n - 1) { s.k -= 1; s.i++; }
      }
      const a = Math.min(s.i, n - 1), b = Math.min(a + 1, n - 1);
      const sideA = tp.hits[a * 2], sideB = tp.hits[b * 2];
      const ya = yOf(tp.hits[a * 2 + 1]), yb = yOf(tp.hits[b * 2 + 1]);
      const k = s.i >= n - 1 ? 1 : s.k;
      const xa = sideA ? RX - 10 : LX + 10, xb = sideB ? RX - 10 : LX + 10;
      // the same paddle twice in a row: out to mid-court and back
      const bx = sideA === sideB ? xa + (W / 2 - xa) * Math.sin(k * Math.PI) : xa + (xb - xa) * k;
      // every third exchange banks off a wall on the way
      let by = ya + (yb - ya) * k;
      if (a % 3 === 0) {
        const wall = a % 2 ? BOT : TOP;
        const da = Math.abs(ya - wall), db = Math.abs(yb - wall);
        const f = da / ((da + db) || 1);
        by = k < f ? ya + (wall - ya) * (k / (f || 1)) : wall + (yb - wall) * ((k - f) / ((1 - f) || 1));
      }
      const nextL = tp.hits[(sideB === 0 ? b : a) * 2 + 1], nextR = tp.hits[(sideB === 1 ? b : a) * 2 + 1];
      s.ly += ((sideB === 0 || sideA === 0 ? nextL : 50) / 100 - s.ly) * Math.min(1, dt * 7);
      s.ry += ((sideB === 1 || sideA === 1 ? nextR : 50) / 100 - s.ry) * Math.min(1, dt * 7);
      c2.strokeStyle = 'rgba(154,93,255,.5)';
      c2.setLineDash([6, 8]);
      c2.beginPath(); c2.moveTo(W / 2, TOP); c2.lineTo(W / 2, BOT); c2.stroke();
      c2.setLineDash([]);
      c2.strokeRect(8, TOP - 6, W - 16, BOT - TOP + 12);
      c2.fillStyle = C.paddleBlue;
      c2.fillRect(LX - 4, TOP + (BOT - TOP) * s.ly - 22, 8, 44);
      c2.fillStyle = C.paddleRed;
      c2.fillRect(RX - 4, TOP + (BOT - TOP) * s.ry - 22, 8, 44);
      s.trail.push([bx, by]);
      if (s.trail.length > 9) s.trail.shift();
      s.trail.forEach(([tx, ty], j) => {
        c2.fillStyle = `rgba(255,255,255,${(j / s.trail.length) * 0.5})`;
        c2.fillRect(tx - 3, ty - 3, 6, 6);
      });
      c2.fillStyle = '#ffffff';
      c2.fillRect(bx - 5, by - 5, 10, 10);
      c2.font = '30px VT323, monospace';
      c2.fillStyle = s.i >= n - 1 ? C.amber : C.text;
      c2.fillText(s.i >= n - 1 ? `${tp.n} HITS — ${playerName()}` : `HIT ${a + 1} / ${n}`, W / 2, H - 30);
      scanlines(c2, W, H, 0.2, 3);
      tex.needsUpdate = true;
    }
    draw(0);
    return { tex, draw };
  })();
  ctx.tvFeeds().push(scoreFeed, replayFeed);

  // ───────────────────────────────────────────────────────────────────────
  // 2. THE EYE ON THE FLOOR — it takes the ceiling TVs and breaks the building
  // ───────────────────────────────────────────────────────────────────────
  const EYE_EVENTS = {
    kernel: { name: 'KERNEL PANIC', line: 'LIGHTS OUT', dur: 10 },
    lag: { name: 'LAG SPIKE', line: 'MOVEMENT UNSTABLE', dur: 7 },
    quantum: { name: 'QUANTUM SHIFT', line: 'CABINETS RELOCATED', dur: 5.5 }
  };
  // one feed per direction the sets face, so the Eye's gaze reads correctly from both sides
  const eyeFeeds = [0, 1].map(() => {
    const W = 192, H = 144;
    const cv = makeCanvas(W, H);
    return { cv, c2: cv.getContext('2d'), tex: canvasTexture(cv), W, H };
  });
  function drawEyeFeed(feed, mirrored, label) {
    const { c2, W, H } = feed;
    const side = player.pos.x * (mirrored ? -1 : 1);
    const img = side < -1.4 ? assets.eyeLeft : side > 1.4 ? assets.eyeRight : assets.eyeNeutral;
    c2.fillStyle = '#16030f';
    c2.fillRect(0, 0, W, H);
    const jx = Math.random() < 0.15 ? (Math.random() - 0.5) * 10 : 0;
    if (img) c2.drawImage(img, W / 2 - 58 + jx, 6, 116, 116);
    c2.textAlign = 'left';
    c2.textBaseline = 'middle';
    c2.font = '12px "Share Tech Mono", monospace';
    c2.fillStyle = '#ff4d6d';
    c2.fillText('● LIVE', 8, 12);
    c2.textAlign = 'center';
    c2.font = '900 15px Orbitron, "Arial Black", sans-serif';
    chromaText(c2, label, W / 2, H - 13, 1.5, C.text, C.pink);
    scanlines(c2, W, H, 0.25, 3);
    if (Math.random() < 0.3) sliceGlitch(c2, W, H, Math.random, 3, 20);
    feed.tex.needsUpdate = true;
  }

  const lightBase = [];       // filled once the whole floor is built (see end of install)
  const fogBase = scene.fog ? scene.fog.density : 0;
  let carpetBase = 0.42;
  const eye = { next: 45 + Math.random() * 35, active: null, t: 0, dark: 0, order: [], feedT: 0, lagT: 0, swapped: false };
  const lagTrail = [];        // [time, x, z] samples of where the player has been

  function startEyeEvent(kind) {
    if (eye.active) return;
    if (!kind) {
      if (!eye.order.length) eye.order = ['kernel', 'lag', 'quantum'].sort(() => Math.random() - 0.5);
      kind = eye.order.pop();
    }
    const ev = EYE_EVENTS[kind];
    eye.active = kind;
    eye.t = 0;
    eye.swapped = false;
    eye.lagT = 0.9;
    ctx.setTvOverride((tv) => eyeFeeds[tv.yaw === 0 ? 0 : 1].tex);
    bannerEl.innerHTML = `<b>THE EYE IS WATCHING</b><span>${ev.name} // ${ev.line}</span>`;
    bannerEl.classList.add('on');
    ctx.worldGlitch();
    audio.sfx('pulse', { volume: 0.5, rate: 0.7 });
    audio.tone({ type: 'sawtooth', from: 70, to: 55, dur: 1.6, volume: 0.07 });
  }

  function endEyeEvent() {
    eye.active = null;
    eye.next = 70 + Math.random() * 70;
    ctx.setTvOverride(null);
    bannerEl.classList.remove('on');
    ctx.worldGlitch(true);
  }

  function swapCabinets(a, b) {
    const pa = a.group.position.clone(), ra = a.group.rotation.y;
    a.group.position.copy(b.group.position); a.group.rotation.y = b.group.rotation.y;
    b.group.position.copy(pa); b.group.rotation.y = ra;
    a.group.updateMatrixWorld(true);
    b.group.updateMatrixWorld(true);
    ['position', 'forward', 'screenCenter', 'screenNormal'].forEach((k) => {
      tmp.copy(a[k]); a[k].copy(b[k]); b[k].copy(tmp);
    });
    const r = a.rotY; a.rotY = b.rotY; b.rotY = r;
    patrons.forEach((p) => { if (p.cab === a || p.cab === b) patronLeave(p); });
  }

  function quantumShift() {
    // never the cabinet you're standing at
    const pool = deadCabs.filter((c) => Math.hypot(c.position.x - player.pos.x, c.position.z - player.pos.z) > 3);
    if (pool.length < 2) return;
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const b = pool[Math.floor(Math.random() * pool.length)];
    swapCabinets(a, b);
    sparks(a); sparks(b);
    ctx.worldGlitch();
    ctx.toast(`QUANTUM SHIFT: ${a.title} ⇄ ${b.title}`);
  }

  function updateEye(dt) {
    const exploring = ctx.state === 'explore';
    // remember the last second of walking for the lag spike to rewind to
    if (exploring) {
      lagTrail.push([ctx.elapsed(), player.pos.x, player.pos.z]);
      while (lagTrail.length && ctx.elapsed() - lagTrail[0][0] > 1.2) lagTrail.shift();
    }
    if (!eye.active) {
      if (exploring && ctx.insideFactor() > 0.9 && player.pos.x < hx) eye.next -= dt;
      if (eye.next <= 0) startEyeEvent();
    } else {
      const ev = EYE_EVENTS[eye.active];
      eye.t += dt;
      eye.feedT += dt;
      if (eye.feedT > 1 / (isTouch ? 8 : 12)) {
        eye.feedT = 0;
        const seen = (yaw) => ctx.tvs.some((tv) => tv.seen && tv.yaw === yaw);
        if (seen(0)) drawEyeFeed(eyeFeeds[0], false, ev.name);
        if (seen(Math.PI)) drawEyeFeed(eyeFeeds[1], true, ev.name);
      }
      if (eye.active === 'lag' && exploring) {
        if (reducedMotion) {
          player.vel.multiplyScalar(Math.max(0, 1 - dt * 6));       // wade instead of snapping back
        } else {
          eye.lagT -= dt;
          if (eye.lagT <= 0 && lagTrail.length) {
            eye.lagT = 1.0 + Math.random() * 0.7;
            const target = ctx.elapsed() - 0.6;
            const back = lagTrail.find((p) => p[0] >= target) || lagTrail[0];
            player.pos.x = back[1];
            player.pos.z = back[2];
            player.vel.set(0, 0, 0);
            ctx.worldGlitch(true);
          }
        }
      }
      if (eye.active === 'quantum' && !eye.swapped && eye.t > 1.3) { eye.swapped = true; quantumShift(); }
      if (eye.t >= ev.dur) endEyeEvent();
    }
    // Kernel Panic: fade the building's lights down and back up
    const want = eye.active === 'kernel' && eye.t > 0.4 && eye.t < EYE_EVENTS.kernel.dur - 1 ? 1 : 0;
    if (eye.dark !== want) {
      eye.dark += Math.sign(want - eye.dark) * Math.min(Math.abs(want - eye.dark), dt * (want ? 2.4 : 1.2));
      const flick = !reducedMotion && want && eye.dark < 0.9 && Math.random() < 0.3 ? 0.5 : 0;
      const k = Math.max(0, eye.dark - flick);
      lightBase.forEach(([l, base]) => { l.intensity = base * (1 - 0.9 * k); });
      const carpet = ctx.carpetMat();
      if (carpet) carpet.emissiveIntensity = carpetBase * (1 - 0.85 * k);
      if (scene.fog) scene.fog.density = fogBase * (1 + 0.9 * k);
      blackoutEl.style.opacity = String(0.62 * k);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // GLITCH PATRONS — silhouettes at the dead cabinets that won't be looked at
  // ───────────────────────────────────────────────────────────────────────
  const patronUniforms = { uTime: { value: 0 } };
  function patronMaterial(seed) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: patronUniforms.uTime, uDissolve: { value: 1 }, uSeed: { value: seed }, uTint: { value: new THREE.Color(C.cyan) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float uTime; uniform float uDissolve; uniform float uSeed; uniform vec3 uTint;
        varying vec2 vUv;
        float hash(float n) { return fract(sin(n * 91.345 + uSeed) * 47453.5453); }
        float rect(vec2 p, vec2 c, vec2 h) { vec2 d = abs(p - c) - h; return step(max(d.x, d.y), 0.0); }
        // a standing figure, arms forward at the controls
        float body(vec2 p) {
          float s = step(length((p - vec2(0.5, 0.88)) * vec2(1.0, 0.42)), 0.105);
          s = max(s, rect(p, vec2(0.5, 0.62), vec2(0.17, 0.16)));
          s = max(s, rect(p, vec2(0.5, 0.80), vec2(0.045, 0.03)));
          s = max(s, rect(p, vec2(0.41, 0.24), vec2(0.07, 0.24)));
          s = max(s, rect(p, vec2(0.59, 0.24), vec2(0.07, 0.24)));
          s = max(s, rect(p, vec2(0.25, 0.60), vec2(0.06, 0.11)));
          s = max(s, rect(p, vec2(0.75, 0.60), vec2(0.06, 0.11)));
          return s;
        }
        void main() {
          float row = floor(vUv.y * 46.0);
          float tick = floor(uTime * 9.0);
          float shove = step(0.82, hash(row + tick * 3.1)) * (hash(row * 1.7 + tick) - 0.5) * 0.22;
          shove += (hash(row * 5.3) - 0.5) * uDissolve * 1.4;
          vec2 p = vec2(vUv.x + shove, vUv.y);
          float core = body(p);
          float left = body(p + vec2(0.035, 0.0));
          float right = body(p - vec2(0.035, 0.0));
          float gone = step(hash(row * 7.9 + 2.0), uDissolve);
          float lines = 0.55 + 0.45 * step(0.5, fract(vUv.y * 46.0));
          vec3 col = vec3(0.02, 0.02, 0.05) * core + vec3(1.0, 0.2, 0.85) * left * (1.0 - core) + uTint * right * (1.0 - core);
          float a = max(core * 0.82, max(left, right) * 0.6) * (1.0 - gone) * lines * (1.0 - uDissolve * 0.6);
          if (a < 0.02) discard;
          gl_FragColor = vec4(col, a);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
  }
  const patrons = [];
  for (let i = 0; i < 4; i++) {
    const mesh = dyn(new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.85), patronMaterial(i * 13.7 + 1)));
    mesh.visible = false;
    mesh.renderOrder = 2;
    scene.add(mesh);
    patrons.push({ mesh, cab: null, state: 'gone', wait: i * 1.5, dissolve: 1 });
  }
  function patronLeave(p) {
    if (p.state !== 'present') return;
    p.state = 'leaving';
    audio.noise({ dur: 0.25, type: 'bandpass', freq: 3200, q: 2, volume: 0.07, at: p.mesh.position, dest: audio.indoorBus });
  }
  function updatePatrons(dt) {
    patrons.forEach((p) => {
      if (p.state === 'gone') {
        p.wait -= dt;
        if (p.wait > 0) return;
        // a dead cabinet nobody is standing near (repaired ones only if there's nothing else)
        const taken = patrons.filter((q) => q !== p && q.cab).map((q) => q.cab);
        let free = deadCabs.filter((c) => !taken.includes(c) && Math.hypot(c.position.x - player.pos.x, c.position.z - player.pos.z) > 7);
        const dead = free.filter((c) => !isRepaired(c));
        if (dead.length) free = dead;
        if (!free.length) { p.wait = 3; return; }
        p.cab = free[Math.floor(Math.random() * free.length)];
        p.mesh.position.copy(p.cab.position).addScaledVector(p.cab.forward, 0.92).setY(0.93);
        p.mesh.material.uniforms.uTint.value.set(p.cab.accent);
        p.mesh.visible = true;
        p.state = 'present';
        return;
      }
      const near = Math.hypot(p.mesh.position.x - player.pos.x, p.mesh.position.z - player.pos.z);
      if (p.state === 'present' && near < 3.3 && ctx.state !== 'intro') patronLeave(p);
      const want = p.state === 'present' ? 0 : 1;
      p.dissolve += Math.sign(want - p.dissolve) * Math.min(Math.abs(want - p.dissolve), dt * (want ? 2.6 : 1.4));
      p.mesh.material.uniforms.uDissolve.value = p.dissolve;
      // face the camera, upright
      p.mesh.rotation.y = Math.atan2(camera.position.x - p.mesh.position.x, camera.position.z - p.mesh.position.z);
      if (p.state === 'leaving' && p.dissolve >= 1) {
        p.state = 'gone';
        p.cab = null;
        p.mesh.visible = false;
        p.wait = 6 + Math.random() * 9;
      }
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // PRIZES THAT DO SOMETHING
  // ───────────────────────────────────────────────────────────────────────
  // ── Heat Gauge: mounts on the wall by the Glitch Pong stage, reads your win streak ──
  const gauge = (() => {
    const group = dyn(new THREE.Group());
    group.position.set(-hx + 0.04, 2.15, -22.4);
    group.rotation.y = Math.PI / 2;
    scene.add(group);
    const cv = makeCanvas(256, 256);
    const c2 = cv.getContext('2d');
    const tex = canvasTexture(cv);
    const dial = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    group.scale.setScalar(1.25);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.3, 0.01), neonMaterial('#ffffff', 1.2));
    needle.geometry.translate(0, 0.15, 0);
    needle.position.set(0, -0.08, 0.012);
    group.add(dial, needle);
    let target = 0, shown = false;
    function refresh() {
      const owned = owns('heat-gauge');
      const p = gpData();
      const streak = p.currentWinStreak || 0, best = p.bestWinStreak || 0;
      target = Math.min(1, streak / 7);
      c2.fillStyle = '#0b0816';
      c2.fillRect(0, 0, 256, 256);
      c2.strokeStyle = owned ? C.purple : 'rgba(154,93,255,.35)';
      c2.lineWidth = 6;
      c2.strokeRect(3, 3, 250, 250);
      c2.textAlign = 'center';
      c2.textBaseline = 'middle';
      if (owned) {
        [[C.cyan, 0], [C.amber, 1], [C.pink, 2]].forEach(([col, i]) => {
          c2.strokeStyle = col;
          c2.lineWidth = 14;
          c2.beginPath();
          c2.arc(128, 148, 86, Math.PI * (1.17 + i * 0.222), Math.PI * (1.17 + (i + 1) * 0.222) - 0.03);
          c2.stroke();
        });
        c2.font = '900 22px Orbitron, "Arial Black", sans-serif';
        chromaText(c2, 'WIN STREAK', 128, 30, 2, C.text);
        c2.font = '60px VT323, monospace';
        c2.fillStyle = streak >= 3 ? C.pink : C.text;
        c2.fillText(String(streak), 128, 196);
        c2.font = '16px "Share Tech Mono", monospace';
        c2.fillStyle = '#b9a6e8';
        c2.fillText(`BEST ${best}`, 128, 234);
      } else {
        c2.font = '700 17px Orbitron, sans-serif';
        c2.fillStyle = 'rgba(185,166,232,.6)';
        c2.fillText('MOUNT FOR:', 128, 104);
        c2.fillText('HEAT GAUGE', 128, 132);
        c2.font = '15px "Share Tech Mono", monospace';
        c2.fillText('PRIZE COUNTER ◎ 30', 128, 168);
      }
      tex.needsUpdate = true;
      needle.visible = owned;
      shown = owned;
    }
    refresh();
    return {
      refresh,
      update(dt, t) {
        if (!shown) return;
        const a = (1.0 - target * 2.0) + Math.sin(t * 5) * 0.03 * (0.4 + target);
        needle.rotation.z += (a - needle.rotation.z) * Math.min(1, dt * 3);
      }
    };
  })();

  // ── Golden Paddle Trophy: Glitch Pong's marquee goes gold ──
  const gpCab = cabinets.find((c) => c.id === 'glitch-pong');
  const marquee = (() => {
    const plain = gpCab.marquee.material.map;
    let gold = null;
    function goldTexture() {
      const src = plain.image;
      const cv = makeCanvas(src.width, src.height);
      const c2 = cv.getContext('2d');
      c2.drawImage(src, 0, 0);
      c2.globalCompositeOperation = 'color';
      c2.fillStyle = '#ffc93c';
      c2.fillRect(0, 0, cv.width, cv.height);
      c2.globalCompositeOperation = 'lighter';
      c2.fillStyle = 'rgba(255,190,40,.18)';
      c2.fillRect(0, 0, cv.width, cv.height);
      c2.globalCompositeOperation = 'source-over';
      c2.fillStyle = 'rgba(20,12,0,.82)';
      c2.fillRect(0, cv.height - 30, cv.width, 30);
      c2.font = '900 20px Orbitron, "Arial Black", sans-serif';
      c2.textAlign = 'center';
      c2.textBaseline = 'middle';
      c2.fillStyle = '#ffe9a8';
      c2.fillText('★  HOUSE CHAMPION  ★', cv.width / 2, cv.height - 14);
      return canvasTexture(cv);
    }
    return {
      refresh() {
        const want = owns('golden-paddle');
        if (want && !gold) gold = goldTexture();
        const tex = want ? gold : plain;
        if (gpCab.marquee.material.map !== tex) {
          gpCab.marquee.material.map = tex;
          gpCab.marquee.material.color.set(want ? 0xffffff : 0xd0d0d0);
          gpCab.marquee.material.needsUpdate = true;
        }
      }
    };
  })();
  dyn(gpCab.marquee);

  // ── Glitch Ball: a ball you can kick around the floor ──
  const ball = (() => {
    const R = 0.15;
    const group = dyn(new THREE.Group());
    const core = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), new THREE.MeshStandardMaterial({ color: '#dfe6ff', emissive: '#dfe6ff', emissiveIntensity: 0.35, roughness: 0.3 }));
    group.add(core);
    const bits = [0, 1, 2].map((i) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), neonMaterial(i % 2 ? C.pink : C.cyan, 1.3));
      group.add(b);
      return b;
    });
    scene.add(group);
    const HOME = new THREE.Vector3(2.2, R, -24.4);
    const pos = group.position.copy(HOME);
    const vel = new THREE.Vector3();
    const target = {
      kind: 'ball', center: pos, radius: 0.34, range: 2.6, hidden: true,
      prompt: () => ({ title: 'KICK THE GLITCH BALL', sub: 'YOUR PRIZE // IT BOUNCES' }),
      use() {
        camera.getWorldDirection(tmp);
        vel.set(tmp.x * 8.5, 3.6 + Math.max(0, tmp.y) * 4, tmp.z * 8.5);
        thud(0.5);
        return true;
      }
    };
    rayTargets.push(target);
    let lastThud = 0;
    function thud(v) {
      if (ctx.elapsed() - lastThud < 0.08) return;
      lastThud = ctx.elapsed();
      audio.sfx('wall', { volume: Math.min(0.5, 0.12 + v * 0.3), at: pos, bus: 'indoor', rate: 0.8 + Math.random() * 0.4 });
    }
    function refresh() {
      const owned = owns('glitch-ball');
      group.visible = owned;
      target.hidden = !owned;
    }
    refresh();
    return {
      refresh,
      moving: () => group.visible && (vel.lengthSq() > 1e-4 || pos.y > R + 0.001),
      update(dt, t) {
        if (!group.visible) return;
        bits.forEach((b, i) => b.position.set(Math.cos(t * 2.4 + i * 2.1) * 0.24, Math.sin(t * 3.1 + i) * 0.1, Math.sin(t * 2.4 + i * 2.1) * 0.24));
        // the player walking into it
        const dx = pos.x - player.pos.x, dz = pos.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (ctx.state === 'explore' && d < 0.35 + R && pos.y - player.pos.y < 1.1) {
          const push = Math.hypot(player.vel.x, player.vel.z) * 1.35 + 1.2;
          const nx = d > 0.001 ? dx / d : 1, nz = d > 0.001 ? dz / d : 0;
          vel.x = nx * push; vel.z = nz * push; vel.y = Math.max(vel.y, 1.2 + push * 0.18);
          pos.x = player.pos.x + nx * (0.36 + R); pos.z = player.pos.z + nz * (0.36 + R);
          thud(push * 0.1);
        }
        if (vel.lengthSq() < 1e-4 && pos.y <= R + 0.001) return;      // at rest
        vel.y -= 14 * dt;
        pos.addScaledVector(vel, dt);
        const floorY = ctx.floorHeightAt(pos.x, pos.z) + R;
        if (pos.y < floorY) {
          pos.y = floorY;
          if (vel.y < -1.2) thud(-vel.y * 0.08);
          vel.y = vel.y < -1 ? -vel.y * 0.55 : 0;
          const drag = Math.exp(-1.5 * dt);
          vel.x *= drag; vel.z *= drag;
          if (Math.hypot(vel.x, vel.z) < 0.05) { vel.x = 0; vel.z = 0; }
        }
        if (pos.y < 2.4) {
          for (const b of colliders) {
            const cx = Math.max(b.minX, Math.min(pos.x, b.maxX)), cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
            let nx = pos.x - cx, nz = pos.z - cz;
            const d2 = nx * nx + nz * nz;
            if (d2 >= R * R) continue;
            if (d2 < 1e-8) {                     // inside the box: out through the nearest face
              const outs = [[b.minX - pos.x, -1, 0], [b.maxX - pos.x, 1, 0], [b.minZ - pos.z, 0, -1], [b.maxZ - pos.z, 0, 1]]
                .sort((p, q) => Math.abs(p[0]) - Math.abs(q[0]))[0];
              nx = outs[1]; nz = outs[2];
              pos.x += outs[1] * (Math.abs(outs[0]) + R); pos.z += outs[2] * (Math.abs(outs[0]) + R);
            } else {
              const dd = Math.sqrt(d2);
              nx /= dd; nz /= dd;
              pos.x += nx * (R - dd); pos.z += nz * (R - dd);
            }
            const vn = vel.x * nx + vel.z * nz;
            if (vn < 0) {
              vel.x -= 1.65 * vn * nx; vel.z -= 1.65 * vn * nz;
              if (vn < -1) thud(-vn * 0.07);
            }
          }
        }
        group.rotation.x += vel.z * dt * 5;
        group.rotation.z -= vel.x * dt * 5;
        // lost under the map or out in the street: back to its spot
        if (pos.y < -2 || Math.abs(pos.x) > 40 || pos.z > 30 || pos.z < -50) { pos.copy(HOME); vel.set(0, 0, 0); }
      }
    };
  })();

  // ───────────────────────────────────────────────────────────────────────
  // ON THE COUNTER — the mystery capsule machine, its toys, the record crate
  // ───────────────────────────────────────────────────────────────────────
  const counterY = COUNTER.h + 0.06;
  const counterZ = COUNTER.front - 0.26;
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3, ...extra });
  const lit = (color, i = 0.8) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.4 });

  // ── capsule machine ──
  (() => {
    const x = 2.3;
    const g = new THREE.Group();
    g.position.set(x, counterY, counterZ);
    scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.2, 20), lit('#c2188f', 0.35));
    base.position.y = 0.1;
    const chute = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.04), std(0x0a0812));
    chute.position.set(0, 0.07, 0.16);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), std(0xd8d8e8, { metalness: 0.9, roughness: 0.25 }));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(0, 0.15, 0.16);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 14), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false }));
    glass.position.y = 0.36;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.05, 16), lit('#c2188f', 0.35));
    cap.position.y = 0.55;
    g.add(base, chute, knob, glass, cap);
    [C.cyan, C.amber, C.pink, C.green, C.purple, '#ff7a3d'].forEach((col, i) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), lit(col, 0.7));
      const a = (i / 6) * Math.PI * 2;
      c.position.set(Math.cos(a) * 0.08, 0.27 + (i % 2) * 0.07, Math.sin(a) * 0.08);
      g.add(c);
    });
    rayTargets.push({
      kind: 'capsule', center: new THREE.Vector3(x, counterY + 0.33, counterZ), radius: 0.27, range: 3.2,
      prompt(key, w) {
        if (F().capsule.bought) return { soon: true, key: '✓', title: 'MYSTERY CAPSULE', sub: 'SOLD OUT TODAY // A NEW ONE TOMORROW' };
        if (w.coins < CAPSULE_COST) return { soon: true, title: 'MYSTERY CAPSULE', sub: `◎ ${CAPSULE_COST} COINS // NEED ${CAPSULE_COST - w.coins} MORE` };
        return { title: 'BUY MYSTERY CAPSULE', sub: `◎ ${CAPSULE_COST} COINS // ONE PER DAY · ${F().toys.length}/${CAPSULE_TOYS.length} TOYS` };
      },
      use() {
        const f = F();
        if (f.capsule.bought) { ctx.robotSay('ONE CAPSULE PER HUMAN PER DAY. THE MACHINE REFILLS AT MIDNIGHT.'); return true; }
        if (!Wallet.spend(CAPSULE_COST)) { audio.deny(); ctx.robotSay(`THE CAPSULE MACHINE TAKES ${CAPSULE_COST} COINS. IT DOES NOT TAKE EXCUSES.`); return true; }
        const prize = capsuleOfDay(f.capsule.date, f.toys);
        f.capsule.bought = true;
        if (prize.kind === 'toy') f.toys.push(prize.toy.id);
        store.save();
        ctx.pulseCoinHud();
        audio.redeem();
        if (prize.kind === 'toy') {
          refreshToys(prize.toy.id);
          ctx.toast(`CAPSULE: ${prize.toy.name} (${f.toys.length}/${CAPSULE_TOYS.length} TOYS)`);
          ctx.robotSay(`A ${prize.toy.name}! ${f.toys.length === CAPSULE_TOYS.length ? 'THAT IS THE FULL SET. I AM RUNNING OUT OF THINGS TO SELL YOU.' : 'IT GOES ON MY COUNTER WITH THE OTHERS.'}`);
        } else {
          pay(prize.coins);
          ctx.toast(`CAPSULE: JACKPOT — +${prize.coins} COINS`);
          ctx.robotSay(`THE CAPSULE HELD ${prize.coins} COINS. THE HOUSE DOES NOT ALWAYS WIN. DO NOT TELL THE EYE.`);
        }
        return true;
      }
    });
  })();

  // ── capsule toys: a row on the counter beside the machine ──
  const toyModels = CAPSULE_TOYS.map((toy, i) => {
    const g = dyn(new THREE.Group());
    g.position.set(2.72 + i * 0.135, counterY, counterZ + 0.02);
    const m = lit(toy.color, 0.75);
    const add = (geo, x = 0, y = 0.05, z = 0, mat = m) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
    if (i === 0) { add(new THREE.BoxGeometry(0.06, 0.06, 0.05), 0, 0.035); add(new THREE.BoxGeometry(0.075, 0.055, 0.06), 0, 0.095); }
    else if (i === 1) { add(new THREE.BoxGeometry(0.06, 0.12, 0.06), 0, 0.06); add(new THREE.BoxGeometry(0.04, 0.035, 0.005), 0, 0.085, 0.032, lit('#ffffff', 0.9)); }
    else if (i === 2) { add(new THREE.SphereGeometry(0.045, 12, 10), 0, 0.05); add(new THREE.SphereGeometry(0.018, 8, 6), 0, 0.05, 0.036, new THREE.MeshBasicMaterial({ color: 0x000000 })); }
    else if (i === 3) { const c = add(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 20), 0, 0.05); c.rotation.x = Math.PI / 2; }
    else if (i === 4) { const c = add(new THREE.BoxGeometry(0.05, 0.05, 0.05), 0, 0.045); c.rotation.set(0.6, 0.6, 0); }
    else if (i === 5) { const c = add(new THREE.TorusGeometry(0.035, 0.008, 6, 16, Math.PI * 1.5), 0, 0.045); c.rotation.x = -0.4; }
    else if (i === 6) { add(new THREE.CylinderGeometry(0.035, 0.04, 0.02, 12), 0, 0.01, 0, std(0x1a1430)); add(new THREE.SphereGeometry(0.042, 12, 10), 0, 0.058, 0, new THREE.MeshStandardMaterial({ color: toy.color, emissive: toy.color, emissiveIntensity: 0.3, transparent: true, opacity: 0.55 })); }
    else { add(new THREE.BoxGeometry(0.045, 0.1, 0.006), 0, 0.05); add(new THREE.BoxGeometry(0.03, 0.03, 0.006), 0, 0.118); }
    g.visible = false;
    scene.add(g);
    return { toy, g, pop: 0 };
  });
  function refreshToys(justGot = null) {
    const have = F().toys;
    toyModels.forEach((t) => {
      t.g.visible = have.includes(t.toy.id);
      if (t.toy.id === justGot) t.pop = 1;
    });
  }
  refreshToys();

  // ── record crate: extra jukebox music, sold here ──
  (() => {
    const x = -1.15;
    const g = new THREE.Group();
    g.position.set(x, counterY, counterZ);
    scene.add(g);
    const wood = std(0x2a1c3e, { roughness: 0.7, metalness: 0.1 });
    [[0, 0.01, 0, 0.46, 0.02, 0.3], [0, 0.1, -0.14, 0.46, 0.2, 0.02], [0, 0.07, 0.14, 0.46, 0.14, 0.02], [-0.22, 0.1, 0, 0.02, 0.2, 0.3], [0.22, 0.1, 0, 0.02, 0.2, 0.3]]
      .forEach(([px, py, pz, w, h, d]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); b.position.set(px, py, pz); g.add(b); });
    ['#50fa7b', '#b100d3', '#71efff', '#ffd27a', '#ff58d9'].forEach((col, i) => {
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.012), lit(col, 0.45));
      sleeve.position.set(-0.02 + (i % 2) * 0.04, 0.2, -0.09 + i * 0.045);
      sleeve.rotation.x = -0.12;
      g.add(sleeve);
    });
    const lcv = makeCanvas(256, 64);
    const l2 = lcv.getContext('2d');
    l2.fillStyle = '#0b0816';
    l2.fillRect(0, 0, 256, 64);
    l2.font = '900 30px Orbitron, "Arial Black", sans-serif';
    l2.textAlign = 'center';
    l2.textBaseline = 'middle';
    chromaText(l2, 'RECORDS', 128, 34, 2, C.text, C.pink);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: canvasTexture(lcv), toneMapped: false }));
    label.position.set(0, 0.07, 0.152);
    g.add(label);
    const packLeft = () => TRACK_PACKS.filter((p) => !F().packs.includes(p.id)).length;
    rayTargets.push({
      kind: 'records', center: new THREE.Vector3(x, counterY + 0.2, counterZ), radius: 0.28, range: 3.2,
      prompt: () => ({ title: 'BROWSE RECORDS', sub: packLeft() ? `JUKEBOX MUSIC // ${packLeft()} FOR SALE` : 'JUKEBOX MUSIC // YOU OWN THEM ALL' }),
      use() {
        openList({
          title: 'RECORD CRATE',
          sub: () => `MORE MUSIC FOR THE JUKEBOX BY THE DOOR  //  ◎ ${Wallet.get().coins} COINS`,
          items: () => TRACK_PACKS.map((p) => {
            const owned = F().packs.includes(p.id);
            return {
              label: `${p.name} · ${p.count} TRACKS`,
              note: owned ? 'OWNED' : `◎ ${p.cost}`,
              disabled: owned,
              stay: true,
              pick() {
                if (!Wallet.spend(p.cost)) { audio.deny(); ctx.robotSay(`THE ${p.name} COSTS ${p.cost} COINS. YOU ARE ${p.cost - Wallet.get().coins} SHORT.`); return; }
                F().packs.push(p.id);
                store.save();
                audio.setOwnedPacks(F().packs);
                audio.redeem();
                ctx.pulseCoinHud();
                ctx.toast(`RECORD BOUGHT: ${p.name} — CHOOSE IT AT THE JUKEBOX`);
                ctx.robotSay(`THE ${p.name}. GOOD TASTE. IT IS IN THE JUKEBOX NOW.`);
              }
            };
          })
        });
        return true;
      }
    });
  })();
  audio.setOwnedPacks(F().packs);

  // ── cosmetics rack: the Glitch Pong Store items that cost coins, sold here too ──
  // The catalog and the purchase both belong to glitchpong-cosmetics.js; this is
  // only a second place to pay.
  const cosmetics = () => (typeof window !== 'undefined' && window.GlitchCosmetics && window.GlitchCosmetics.coinItems ? window.GlitchCosmetics : null);
  const cosmeticsForSale = () => { const cos = cosmetics(); return cos ? cos.coinItems().filter((it) => !it.owned) : []; };
  (() => {
    const x = 1.25;
    const g = new THREE.Group();
    g.position.set(x, counterY, counterZ);
    scene.add(g);
    const frame = std(0x2a1c3e, { roughness: 0.7, metalness: 0.1 });
    [[0, 0.01, 0, 0.5, 0.02, 0.18], [-0.24, 0.18, 0, 0.02, 0.34, 0.02], [0.24, 0.18, 0, 0.02, 0.34, 0.02], [0, 0.35, 0, 0.5, 0.02, 0.02]]
      .forEach(([px, py, pz, w, h, d]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frame); b.position.set(px, py, pz); g.add(b); });
    // five little paddles hanging from the rail, one in each neon colour
    [C.cyan, C.pink, C.amber, C.green, C.purple].forEach((col, i) => {
      const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.02), lit(col, 0.7));
      paddle.position.set(-0.16 + i * 0.08, 0.22, 0);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.008), std(0xd8d8e8, { metalness: 0.9, roughness: 0.25 }));
      hook.position.set(-0.16 + i * 0.08, 0.335, 0);
      g.add(paddle, hook);
    });
    const lcv = makeCanvas(256, 64);
    const l2 = lcv.getContext('2d');
    l2.fillStyle = '#0b0816';
    l2.fillRect(0, 0, 256, 64);
    l2.font = '900 30px Orbitron, "Arial Black", sans-serif';
    l2.textAlign = 'center';
    l2.textBaseline = 'middle';
    chromaText(l2, 'SKINS', 128, 34, 2, C.text, C.cyan);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: canvasTexture(lcv), toneMapped: false }));
    label.position.set(0, 0.07, 0.092);
    g.add(label);
    rayTargets.push({
      kind: 'cosmetics', center: new THREE.Vector3(x, counterY + 0.2, counterZ), radius: 0.28, range: 3.2,
      prompt: () => {
        if (!cosmetics()) return { soon: true, title: 'COSMETICS RACK', sub: 'OUT OF ORDER' };
        const left = cosmeticsForSale().length;
        return { title: 'BROWSE COSMETICS', sub: left ? `GLITCH PONG STORE ITEMS // ${left} FOR SALE` : 'GLITCH PONG STORE ITEMS // YOU OWN THEM ALL' };
      },
      use() {
        const cos = cosmetics();
        if (!cos) { audio.deny(); return true; }
        openList({
          title: 'COSMETICS RACK',
          sub: () => `FOR YOUR GLITCH PONG LOCKER  //  ◎ ${Wallet.get().coins} COINS`,
          items: () => cos.coinItems().map(({ slot, item, cost, owned }) => ({
            label: `${item.name} · ${cos.SLOT_INFO[slot].noun}`,
            note: owned ? 'OWNED' : `◎ ${cost}`,
            disabled: owned,
            stay: true,
            pick() {
              const result = cos.buy(slot, item.id, Wallet, gpData());
              if (result === 'poor') { audio.deny(); ctx.robotSay(`THE ${item.name} COSTS ${cost} COINS. YOU ARE ${cost - Wallet.get().coins} SHORT.`); return; }
              if (result !== 'ok') return;
              try { if (typeof GlitchProgression !== 'undefined') GlitchProgression.save(); } catch (e) {}
              audio.redeem();
              ctx.pulseCoinHud();
              ctx.toast(`COSMETIC BOUGHT: ${item.name} — EQUIP IT IN THE GLITCH PONG STORE`);
              ctx.robotSay(`THE ${item.name}. IT IS IN YOUR LOCKER. OPEN THE STORE ON THE GLITCH PONG MENU TO WEAR IT.`);
            }
          }))
        });
        return true;
      }
    });
  })();

  // ── jukebox: pick the track, and PRIZETRON's request ──
  function ensureRequest() {
    const f = F();
    if (f.request.title) return f.request;
    const open = audio.tracks().filter((t) => !t.locked);
    const rand = mulberry32(hashStr('gc_request_' + f.request.date));
    f.request.title = open[Math.floor(rand() * open.length)].title;
    store.save();
    return f.request;
  }

  function openJukebox() {
    openList({
      title: 'JUKEBOX',
      sub: () => `NOW PLAYING: ${audio.trackTitle}`,
      items: () => {
        const tracks = audio.tracks();
        const items = tracks.filter((t) => !t.locked).map((t) => ({
          label: t.title,
          note: t.index === audio.trackIndex ? '♪ PLAYING' : '',
          pick() {
            const title = audio.selectTrack(t.index);
            if (!title) return;
            ctx.toast(`NOW PLAYING: ${title}`);
            const req = ensureRequest();
            if (!req.done && req.title === title) {
              req.done = true;
              store.save();
              pay(3);
              ctx.setRobotPending(`YOU PLAYED MY REQUEST. ${title}. THREE COINS FOR THE DJ.`);
              ctx.toast(`PRIZETRON'S REQUEST PLAYED: +3 COINS`);
            }
          }
        }));
        TRACK_PACKS.filter((p) => !F().packs.includes(p.id)).forEach((p) => {
          items.push({ label: `${p.name} · ${p.count} TRACKS`, note: 'RECORD CRATE ◎ ' + p.cost, disabled: true });
        });
        return items;
      }
    });
    // start on the track that's playing
    if (list) { list.index = Math.max(0, list.items.findIndex((it) => it.note === '♪ PLAYING')); renderList(); }
  }

  // ── what PRIZETRON has to say about your record ──
  function robotLines(w) {
    const f = F();
    const p = gpData();
    const out = [];
    const wins = p.wins || 0, losses = p.losses || 0, streak = p.currentWinStreak || 0, rally = p.longestRally || 0;
    if (streak >= 3) out.push(`A ${streak}-WIN STREAK. THE EYE HAS NOTICED. SO HAVE I.`);
    else if (wins + losses >= 3 && wins === 0) out.push(`ZERO WINS IN ${wins + losses} MATCHES. I ADMIRE PERSISTENCE. THE EASY AI DOES NOT JUDGE.`);
    else if (wins + losses >= 5) out.push(`YOUR RECORD: ${wins} WINS, ${losses} LOSSES. ${wins >= losses ? 'THE MACHINES ARE CONCERNED.' : 'THE MACHINES ARE NOT YET CONCERNED.'}`);
    if (rally >= 12) out.push(`YOUR ${rally}-HIT RALLY IS ON THE CEILING TVS. I HAVE WATCHED IT ${rally >= 30 ? 'ELEVEN TIMES' : 'TWICE'}.`);
    const n = f.repaired.length;
    if (n < 8) {
      out.push(chipReady()
        ? 'YOU OWN AN OVERCLOCK CHIP. INSTALL IT IN A DEAD CABINET AND IT REPAIRS THE MACHINE FOR FREE.'
        : `${8 - n} CABINET${8 - n > 1 ? 'S ARE' : ' IS'} STILL DARK. THE NEXT REPAIR COSTS ${repairCost(n)} COINS. A REPAIRED MACHINE RUNS A 30-SECOND ROM FRAGMENT THAT PAYS.`);
    }
    if (f.hockey.wins + f.hockey.losses) {
      out.push(f.hockey.wins >= f.hockey.losses
        ? `AIR HOCKEY: YOU LEAD ME ${f.hockey.wins}–${f.hockey.losses}. I AM RECALIBRATING MY CLAW.`
        : `AIR HOCKEY: I LEAD YOU ${f.hockey.losses}–${f.hockey.wins}. THE TABLE IS OPEN WHENEVER YOU ARE READY.`);
    } else {
      out.push('THE AIR HOCKEY TABLE ON THE FLOOR IS MINE. FIRST TO FIVE. I PAY FOUR COINS IF YOU BEAT ME.');
    }
    const req = ensureRequest();
    if (!req.done) out.push(`REQUEST: PUT ${req.title} ON THE JUKEBOX. I PAY THREE COINS FOR GOOD TASTE.`);
    const rack = cosmeticsForSale();
    if (rack.length) out.push(`THE RACK ON MY COUNTER SELLS GLITCH PONG COSMETICS. ${rack.length} STILL FOR SALE, FROM ${rack[0].cost} COINS.`);
    if (!f.capsule.bought) out.push(`TODAY'S MYSTERY CAPSULE IS ${CAPSULE_COST} COINS. I DO NOT KNOW WHAT IS IN IT. I CHOSE NOT TO LOOK.`);
    const st = dailyState();
    if (!f.daily.claimed) out.push(st.done ? `YOUR DAILY GLITCH IS COMPLETE. CLAIM ${st.ch.reward} COINS AT THE BOARD BY THE DOOR.` : `TODAY'S DAILY GLITCH: ${st.parts.map((x) => x.label).join(' AND ')}. ${st.ch.reward} COINS.`);
    if (w.prizes.length < PRIZES.length) out.push(`THE STAFF DOOR ON THE RIGHT WALL OPENS FOR COLLECTORS WHO EMPTY MY SHELVES. YOU HAVE ${w.prizes.length} OF ${PRIZES.length}.`);
    else out.push(f.gauntlet.clears ? `YOU HAVE CLEARED THE EYE GAUNTLET ${f.gauntlet.clears} TIME${f.gauntlet.clears > 1 ? 'S' : ''}. IT REMEMBERS.` : 'THE STAFF DOOR IS OPEN. CABINET 11 IS NOT ON ANY FLOOR PLAN.');
    return out;
  }

  // ───────────────────────────────────────────────────────────────────────
  // STAFF ONLY — the back room and the eleventh cabinet
  // ───────────────────────────────────────────────────────────────────────
  const ROOM = { x0: hx + ctx.WALL_T, x1: hx + ctx.WALL_T + 6, z0: STAFF_DOOR.z - 3, z1: STAFF_DOOR.z + 3, h: 3.3 };
  const staff = (() => {
    // lit by its own emissive tint rather than a light (see the glow below)
    const wallMat = ctx.matte({ color: 0x1c0a16, emissive: 0x2e0e1d, roughness: 0.9 });
    const T = 0.25;
    const boxAt = (x0, x1, z0, z1, y0, y1, mat = wallMat, solid = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      scene.add(m);
      if (solid) ctx.addCollider(x0, x1, z0, z1);
      return m;
    };
    boxAt(ROOM.x0, ROOM.x1 + T, ROOM.z0 - T, ROOM.z0, 0, ROOM.h);            // north
    boxAt(ROOM.x0, ROOM.x1 + T, ROOM.z1, ROOM.z1 + T, 0, ROOM.h);            // south
    boxAt(ROOM.x1, ROOM.x1 + T, ROOM.z0, ROOM.z1, 0, ROOM.h);                // east
    boxAt(ROOM.x0, ROOM.x1 + T, ROOM.z0 - T, ROOM.z1 + T, ROOM.h, ROOM.h + 0.2, wallMat, false);   // ceiling
    // floor: red-on-black checker
    const fcv = makeCanvas(128, 128);
    const f2 = fcv.getContext('2d');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      f2.fillStyle = (x + y) % 2 ? '#1a0610' : '#0a0408';
      f2.fillRect(x * 16, y * 16, 16, 16);
    }
    const ftex = canvasTexture(fcv, { repeat: [3, 3] });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0),
      ctx.matte({ map: ftex, emissiveMap: ftex, emissive: 0xffffff, emissiveIntensity: 0.5 }));
    fl.rotation.x = -Math.PI / 2;
    fl.position.set((ROOM.x0 + ROOM.x1) / 2, 0.008, STAFF_DOOR.z);
    scene.add(fl);
    // red trim and one red light
    const red = '#ff4d6d';
    [ROOM.z0 + 0.03, ROOM.z1 - 0.03].forEach((z) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(ROOM.x1 - ROOM.x0, 0.05, 0.05), neonMaterial(red, 0.9));
      strip.position.set((ROOM.x0 + ROOM.x1) / 2, ROOM.h - 0.25, z);
      scene.add(strip);
    });
    // Not a PointLight: every lit material in the building pays for every light, and
    // this one only matters to a 6 m room. A floor glow and a hotter floor do the job.
    ctx.addFloorGlow(scene, new THREE.Color(red), 6, 6, (ROOM.x0 + ROOM.x1) / 2, STAFF_DOOR.z, 0.45);

    // ── the door ──
    const dcv = makeCanvas(256, 384);
    const d2 = dcv.getContext('2d');
    const dtex = canvasTexture(dcv);
    function drawDoor(open, have) {
      d2.fillStyle = '#120a1c';
      d2.fillRect(0, 0, 256, 384);
      d2.strokeStyle = open ? C.green : '#ff4d6d';
      d2.lineWidth = 8;
      d2.strokeRect(6, 6, 244, 372);
      for (let y = 40; y < 384; y += 48) { d2.fillStyle = 'rgba(255,255,255,.05)'; d2.fillRect(18, y, 220, 3); }
      d2.textAlign = 'center';
      d2.textBaseline = 'middle';
      d2.font = '900 40px Orbitron, "Arial Black", sans-serif';
      chromaText(d2, 'STAFF', 128, 120, 3, C.text, '#ff4d6d');
      chromaText(d2, 'ONLY', 128, 170, 3, C.text, '#ff4d6d');
      d2.font = '20px "Share Tech Mono", monospace';
      d2.fillStyle = open ? C.green : '#ff8fa3';
      d2.fillText(open ? 'UNLOCKED' : 'LOCKED', 128, 240);
      d2.fillText(`PRIZES ${have}/${PRIZES.length}`, 128, 270);
      dtex.needsUpdate = true;
    }
    const doorMat = new THREE.MeshStandardMaterial({ map: dtex, emissiveMap: dtex, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.5 });
    const door = dyn(new THREE.Mesh(new THREE.BoxGeometry(0.08, STAFF_DOOR.h, STAFF_DOOR.w), [doorMat, doorMat, wallMat, wallMat, wallMat, wallMat]));
    door.position.set(hx + 0.12, STAFF_DOOR.h / 2, STAFF_DOOR.z);
    scene.add(door);
    const frameMat = neonMaterial('#ff4d6d', 0.9);
    [-1, 1].forEach((s) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, STAFF_DOOR.h, 0.05), frameMat);
      post.position.set(hx - 0.02, STAFF_DOOR.h / 2, STAFF_DOOR.z + s * (STAFF_DOOR.w / 2 + 0.03));
      scene.add(post);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, STAFF_DOOR.w + 0.12), frameMat);
    lintel.position.set(hx - 0.02, STAFF_DOOR.h + 0.03, STAFF_DOOR.z);
    scene.add(lintel);
    ctx.addFloorGlow(scene, new THREE.Color('#ff4d6d'), 1.8, 1.8, hx - 1, STAFF_DOOR.z, 0.22);

    const blocker = { minX: hx, maxX: hx + ctx.WALL_T, minZ: STAFF_DOOR.z - STAFF_DOOR.w / 2, maxZ: STAFF_DOOR.z + STAFF_DOOR.w / 2 };
    colliders.push(blocker);
    let open = false, openK = 0, announced = Wallet.get().prizes.length >= PRIZES.length;
    const knock = {
      kind: 'staff', scale: 1,
      position: new THREE.Vector3(hx, 0, STAFF_DOOR.z), forward: new THREE.Vector3(-1, 0, 0),
      screenCenter: new THREE.Vector3(hx, 1.4, STAFF_DOOR.z),
      prompt: (key, w) => ({ soon: true, title: 'STAFF ONLY', sub: `LOCKED // COLLECT EVERY PRIZE (${w.prizes.length}/${PRIZES.length})` }),
      use() {
        audio.deny();
        ctx.robotSay('THAT DOOR IS FOR STAFF. AND FOR COLLECTORS WHO EMPTY MY SHELVES. YOU ARE NOT YET EITHER.');
        return true;
      }
    };
    interactables.push(knock);
    function refresh() {
      const have = Wallet.get().prizes.length;
      const want = have >= PRIZES.length;
      drawDoor(want, have);
      if (want === open) return;
      open = want;
      knock.hidden = open;
      const i = colliders.indexOf(blocker);
      if (open && i >= 0) colliders.splice(i, 1);
      if (!open && i < 0) colliders.push(blocker);
      if (open && !announced) {
        announced = true;
        ctx.toast('SOMEWHERE ON THE RIGHT WALL, A LOCK CLICKS OPEN. STAFF ONLY.', 4200);
        ctx.setRobotPending('YOU EMPTIED MY SHELVES. THE STAFF DOOR IS OPEN. CABINET 11 IS NOT ON ANY FLOOR PLAN. BE CAREFUL IN THERE.');
        audio.sfx('teleport', { volume: 0.4, at: door.position, bus: 'indoor', ref: 3 });
      }
    }
    return {
      refresh,
      update(dt) {
        const want = open ? 1 : 0;
        if (openK === want) return;
        openK += Math.sign(want - openK) * Math.min(Math.abs(want - openK), dt * 0.9);
        door.position.y = STAFF_DOOR.h / 2 + openK * (STAFF_DOOR.h + 0.05);
      },
      get open() { return open; },
      get moving() { return openK !== (open ? 1 : 0); }
    };
  })();

  // ── Cabinet 11: the Eye gauntlet, a boss rush across both games ──
  const gauntletCab = (() => {
    const accent = '#ff4d6d';
    const W = 256, H = 192;
    const cv = makeCanvas(W, H);
    const c2 = cv.getContext('2d');
    const tex = canvasTexture(cv);
    function draw() {
      const g = F().gauntlet;
      c2.fillStyle = '#12030a';
      c2.fillRect(0, 0, W, H);
      const img = [assets.eyeLeft, assets.eyeNeutral, assets.eyeRight][Math.floor(Math.random() * 3)] || assets.eyeNeutral;
      if (img) c2.drawImage(img, W / 2 - 52, 2, 104, 104);
      c2.textAlign = 'center';
      c2.textBaseline = 'middle';
      c2.font = '900 24px Orbitron, "Arial Black", sans-serif';
      chromaText(c2, 'EYE GAUNTLET', W / 2, 122, 2, C.text, accent);
      c2.font = '15px "Share Tech Mono", monospace';
      c2.fillStyle = g.r1 ? C.green : '#ff8fa3';
      c2.fillText(`R1 GLITCH PONG ${g.r1 ? '[x]' : '[ ]'}`, W / 2, 148);
      c2.fillStyle = g.r2 ? C.green : '#ff8fa3';
      c2.fillText(`R2 BREAKPOINT  ${g.r2 ? '[x]' : '[ ]'}`, W / 2, 168);
      scanlines(c2, W, H, 0.22, 3);
      if (Math.random() < 0.4) sliceGlitch(c2, W, H, Math.random, 3, 24);
      tex.needsUpdate = true;
    }
    draw();
    const screenMaterial = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const cab = ctx.buildCabinet({
      width: 1.12, scale: 1.12, bodyColor: 0x1c0610,
      trimLeft: accent, trimRight: accent,
      sideArt: ctx.makeComingSoonSideArt(accent, 66, 'EYE GAUNTLET'),
      marqueeTex: ctx.makeComingSoonMarquee(accent, 11, 'EYE GAUNTLET', '// BOSS RUSH — BOTH GAMES — CABINET 11 //'),
      screenMat: screenMaterial,
      coinTex: ctx.makeCoinDoor('NO REFUNDS', accent),
      accent
    });
    const entry = ctx.registerCabinet(cab, ROOM.x1 - 0.62, STAFF_DOOR.z, -Math.PI / 2, {
      id: 'eye-gauntlet', title: 'EYE GAUNTLET', slot: 11, playable: false, accent, screenMaterial
    });
    if (assets.eyeNeutral) {
      const t0 = new THREE.Texture(assets.eyeNeutral);
      t0.colorSpace = THREE.SRGBColorSpace;
      t0.needsUpdate = true;
      const sp = dyn(new THREE.Sprite(new THREE.SpriteMaterial({ map: t0, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.85 })));
      sp.scale.set(0.8, 0.8, 1);
      sp.position.set(ROOM.x1 - 0.55, 2.82, STAFF_DOOR.z);
      scene.add(sp);
      entry.eyeSprite = sp;
    }

    function startRound(n) {
      const g = F().gauntlet;
      if (n === 1) {
        g.bossBase = gpData().bossSurvivals || 0;
        store.save();
        entry.game = 'glitch-pong';
        entry.bpQuery = '';
      } else {
        entry.game = 'breakpoint';
        entry.bpQuery = '&mode=bossrush';
      }
      ctx.launchGame(entry);
    }

    entry.prompt = () => {
      const g = F().gauntlet;
      return { title: 'ENTER THE EYE GAUNTLET', sub: `CABINET 11 // ROUND 1 ${g.r1 ? '✓' : '·'}  ROUND 2 ${g.r2 ? '✓' : '·'}  CLEARS ${g.clears}` };
    };
    entry.use = () => {
      openList({
        title: 'EYE GAUNTLET',
        sub: () => F().gauntlet.clears
          ? `BEAT THE EYE IN BOTH GAMES FOR ◎ ${GAUNTLET_REWARD} COINS  //  CLEARS: ${F().gauntlet.clears}`
          : `BEAT THE EYE IN BOTH GAMES FOR ◎ ${GAUNTLET_REWARD} COINS AND A NEW GLITCH PONG ARENA`,
        items: () => {
          const g = F().gauntlet;
          return [
            { label: 'ROUND 1 — GLITCH PONG: SURVIVE THE EYE', note: g.r1 ? 'DONE ✓' : 'BUILD HEAT TO SUMMON IT', pick: () => startRound(1) },
            { label: 'ROUND 2 — BREAKPOINT: BOSS RUSH, DEFEAT THE EYE', note: g.r2 ? 'DONE ✓' : '6 GUARDIANS, THE EYE LAST', pick: () => startRound(2) }
          ];
        }
      });
      return true;
    };

    function settle() {
      const g = F().gauntlet;
      if (!(g.r1 && g.r2)) { draw(); return; }
      g.r1 = g.r2 = false;
      g.clears++;
      store.save();
      pay(GAUNTLET_REWARD);
      audio.redeem();
      // The first clear also opens THE EYE'S LAIR in Glitch Pong's arena menu
      // (glitchpong-site.js reads gauntlet.clears from this save).
      const firstClear = g.clears === 1;
      ctx.toast(firstClear
        ? `EYE GAUNTLET CLEARED: +${GAUNTLET_REWARD} COINS  //  NEW ARENA: THE EYE'S LAIR`
        : `EYE GAUNTLET CLEARED: +${GAUNTLET_REWARD} COINS (CLEAR ${g.clears})`, firstClear ? 6000 : 4200);
      ctx.setRobotPending(firstClear
        ? `THE EYE BLINKED FIRST. ${GAUNTLET_REWARD} COINS. AND IT LEFT A DOOR OPEN: THE EYE'S LAIR IS IN GLITCH PONG'S ARENA LIST NOW. I WOULD NOT GO IN.`
        : `THE EYE BLINKED FIRST. ${GAUNTLET_REWARD} COINS. I HAVE NEVER PAID THAT OUT BEFORE. MY CIRCUITS ARE SHAKING.`);
      draw();
    }

    return {
      entry, draw, settle,
      // back from a round of Glitch Pong launched here: did the Eye get survived?
      afterGlitchPong() {
        const g = F().gauntlet;
        if (g.bossBase >= 0 && (gpData().bossSurvivals || 0) > g.bossBase && !g.r1) {
          g.r1 = true;
          store.save();
          ctx.toast('GAUNTLET ROUND 1 COMPLETE: YOU SURVIVED THE EYE', 3600);
        }
        g.bossBase = -1;
        store.save();
        settle();
      },
      eyeDefeatedInBreakpoint() {
        const g = F().gauntlet;
        if (g.r2) return;
        g.r2 = true;
        store.save();
      }
    };
  })();

  // ───────────────────────────────────────────────────────────────────────
  // AIR HOCKEY — first-person Pong against PRIZETRON's remote claw
  // ───────────────────────────────────────────────────────────────────────
  const hockey = (() => {
    const TX = 3.6, TZ = -19.5, HW = 0.62, HL = 1.22, TOPY = 0.84;
    const PW = 0.17, PR = 0.055;                    // paddle half-width, puck radius
    const dark = std(0x120c22, { roughness: 0.45, metalness: 0.35 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 0.24, 0.34, HL * 2 + 0.24), dark);
    body.position.set(TX, TOPY - 0.19, TZ);
    scene.add(body);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, TOPY - 0.34, 0.1), dark);
      leg.position.set(TX + sx * (HW - 0.02), (TOPY - 0.34) / 2, TZ + sz * (HL - 0.02));
      scene.add(leg);
    });
    // playing surface
    const scv = makeCanvas(256, 512);
    const s2 = scv.getContext('2d');
    s2.fillStyle = '#080614';
    s2.fillRect(0, 0, 256, 512);
    s2.strokeStyle = 'rgba(113,239,255,.75)';
    s2.lineWidth = 4;
    s2.strokeRect(6, 6, 244, 500);
    s2.setLineDash([14, 12]);
    s2.beginPath(); s2.moveTo(6, 256); s2.lineTo(250, 256); s2.stroke();
    s2.setLineDash([]);
    s2.strokeStyle = 'rgba(255,88,217,.75)';
    s2.beginPath(); s2.arc(128, 256, 46, 0, Math.PI * 2); s2.stroke();
    const stex = canvasTexture(scv);
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HL * 2), new THREE.MeshStandardMaterial({ map: stex, emissiveMap: stex, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.25 }));
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(TX, TOPY + 0.002, TZ);
    scene.add(surface);
    [-1, 1].forEach((s) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, HL * 2 + 0.12), neonMaterial(s < 0 ? C.cyan : C.pink, 0.9));
      rail.position.set(TX + s * (HW + 0.03), TOPY + 0.035, TZ);
      scene.add(rail);
    });
    ctx.addCollider(TX - HW - 0.12, TX + HW + 0.12, TZ - HL - 0.12, TZ + HL + 0.12);
    ctx.addFloorGlow(scene, new THREE.Color(C.cyan), 3.2, 4.4, TX, TZ, 0.22);

    // moving parts
    const parts = dyn(new THREE.Group());
    parts.position.set(TX, TOPY, TZ);
    scene.add(parts);
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, 0.025, 20), neonMaterial('#ffffff', 1.3));
    puck.position.y = 0.014;
    const mine = new THREE.Mesh(new THREE.BoxGeometry(PW * 2, 0.05, 0.07), neonMaterial(C.paddleBlue, 1.1));
    mine.position.set(0, 0.027, HL - 0.1);
    const his = new THREE.Mesh(new THREE.BoxGeometry(PW * 2, 0.05, 0.07), neonMaterial(C.pink, 1.1));
    his.position.set(0, 0.027, -HL + 0.1);
    // PRIZETRON's remote: a little hologram head over the far end
    const holo = ctx.hologramMaterial('#5fe8ff');
    const remote = new THREE.Group();
    remote.position.set(0, 0.5, -HL - 0.05);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.22), holo);
    remote.add(head);
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), ctx.glowMaterial('#ff58d9'));
      e.position.set(s * 0.07, 0.02, 0.112);
      remote.add(e);
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.1, 0.36, 12, 1, true), ctx.glowMaterial('#5fe8ff', 0.18));
    beam.position.y = -0.3;
    remote.add(beam);
    parts.add(puck, mine, his, remote);

    // scoreboard on a post beside the table
    const bcv = makeCanvas(256, 128);
    const b2 = bcv.getContext('2d');
    const btex = canvasTexture(bcv);
    const board = dyn(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: btex, toneMapped: false, side: THREE.DoubleSide })));
    board.position.set(TX + HW + 0.5, 1.75, TZ);
    board.rotation.y = -Math.PI / 2 + 0.5;
    scene.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.55, 0.05), dark);
    post.position.set(TX + HW + 0.5, 0.775, TZ);
    scene.add(post);

    const g = { on: false, you: 0, him: 0, u: 0, v: 0, vu: 0, vv: 0, pu: 0, au: 0, serve: 0, over: 0, camK: 0, keyL: false, keyR: false, lastLine: -9, aiErr: 0 };
    function drawBoard() {
      b2.fillStyle = '#05040c';
      b2.fillRect(0, 0, 256, 128);
      b2.strokeStyle = C.purple;
      b2.lineWidth = 5;
      b2.strokeRect(3, 3, 250, 122);
      b2.textAlign = 'center';
      b2.textBaseline = 'middle';
      b2.font = '700 17px Orbitron, sans-serif';
      b2.fillStyle = C.paddleBlue;
      b2.fillText('YOU', 66, 28);
      b2.fillStyle = C.pink;
      b2.fillText('P80', 190, 28);
      b2.font = '74px VT323, monospace';
      b2.fillStyle = C.text;
      b2.fillText(String(g.you), 66, 78);
      b2.fillText(String(g.him), 190, 78);
      b2.font = '15px "Share Tech Mono", monospace';
      b2.fillStyle = '#b9a6e8';
      b2.fillText(g.on ? `FIRST TO ${HOCKEY_TARGET}` : `ALL TIME ${F().hockey.wins}–${F().hockey.losses}`, 128, 112);
      btex.needsUpdate = true;
    }
    drawBoard();

    function say(text) {
      if (ctx.elapsed() - g.lastLine < 2.5) return;
      g.lastLine = ctx.elapsed();
      ctx.robotSay(text);
    }
    function serve(toward) {
      g.u = 0; g.v = 0;
      g.vu = (Math.random() - 0.5) * 1.2;
      g.vv = toward * 1.5;
      g.serve = 0.9;
    }
    function tick(v) { audio.tone({ type: 'square', from: v, to: v * 0.9, dur: 0.05, volume: 0.05 }); }

    function finish() {
      const won = g.you > g.him;
      const f = F();
      if (won) {
        f.hockey.wins++;
        if (f.hockey.paid < HOCKEY_PAID_WINS_PER_DAY) {
          f.hockey.paid++;
          store.save();
          pay(HOCKEY_WIN_COINS);
          ctx.toast(`YOU BEAT PRIZETRON ${g.you}–${g.him}: +${HOCKEY_WIN_COINS} COINS`);
        } else {
          store.save();
          ctx.toast(`YOU BEAT PRIZETRON ${g.you}–${g.him}. HE HAS PAID OUT ENOUGH FOR ONE DAY.`);
        }
        g.lastLine = -9;
        say(['WELL PLAYED, HUMAN. MY CLAW WAS LAGGING. PROBABLY.', 'DEFEAT LOGGED. REMATCH WHENEVER YOU DARE.', 'YOU WIN. I BLAME THE EYE.'][Math.floor(Math.random() * 3)]);
      } else {
        f.hockey.losses++;
        store.save();
        ctx.toast(`PRIZETRON WINS ${g.him}–${g.you}`);
        g.lastLine = -9;
        say(['VICTORY IS MINE. THE TABLE IS UNDEFEATED TODAY.', 'I HAVE BEEN PRACTISING SINCE 1980.', 'GOOD GAME. MY CLAW ACCEPTS YOUR SURRENDER.'][Math.floor(Math.random() * 3)]);
      }
      g.over = 2.2;
      dailyBoard.draw();
      drawBoard();
    }

    function stop() {
      g.on = false;
      const arms = ctx.arms();
      if (arms) arms.left.visible = arms.right.visible = true;
      puck.position.set(0, 0.014, 0);
      drawBoard();
    }

    function start() {
      if (!beginBusy({
        kind: 'hockey',
        cancel: stop,
        key(e, down) {
          const c = e.code;
          if (c === 'KeyA' || c === 'ArrowLeft') { g.keyL = down; e.preventDefault(); }
          else if (c === 'KeyD' || c === 'ArrowRight') { g.keyR = down; e.preventDefault(); }
          else if (down && (c === 'KeyQ' || c === 'Escape' || c === 'Backspace')) { e.preventDefault(); endBusy(); }
        },
        mouse(dx) { g.pu = Math.max(-HW + PW, Math.min(HW - PW, g.pu + dx * 0.0019)); },
        update(dt) { update(dt); }
      })) return;
      Object.assign(g, { on: true, you: 0, him: 0, pu: 0, au: 0, over: 0, camK: 0, keyL: false, keyR: false });
      const arms = ctx.arms();
      if (arms) arms.left.visible = arms.right.visible = false;
      serve(Math.random() < 0.5 ? 1 : -1);
      drawBoard();
      showActivity(isTouch
        ? 'DRAG to move your paddle <button type="button" data-act="leave">LEAVE</button>'
        : '<span>MOUSE</span> or <span>A / D</span> move your paddle &nbsp;·&nbsp; <span>Q</span> leave the table');
      g.lastLine = -9;
      say(`AIR HOCKEY. FIRST TO ${HOCKEY_TARGET}. I HAVE NOT LOST SINCE YOU LAST BEAT ME.`);
    }

    const camFrom = new THREE.Vector3(), camTo = new THREE.Vector3(TX, 1.8, TZ + HL + 0.85), look = new THREE.Vector3(TX, TOPY - 0.3, TZ + 0.12);
    function update(dt) {
      // settle the camera at the near end of the table
      if (g.camK === 0) camFrom.copy(camera.position);
      g.camK = Math.min(1, g.camK + dt * 2.6);
      const e = g.camK * g.camK * (3 - 2 * g.camK);
      camera.position.lerpVectors(camFrom, camTo, e);
      camera.lookAt(look);
      if (g.over > 0) {
        g.over -= dt;
        if (g.over <= 0) endBusy();
        return;
      }
      g.pu = Math.max(-HW + PW, Math.min(HW - PW, g.pu + ((g.keyR ? 1 : 0) - (g.keyL ? 1 : 0)) * 1.7 * dt));
      // PRIZETRON: follows the puck when it's coming, with a top speed you can beat
      if (Math.random() < dt * 1.5) g.aiErr = (Math.random() - 0.5) * 0.16;
      const aim = g.vv < 0 ? g.u + g.aiErr : g.u * 0.3;
      const aiSpeed = 1.15 + Math.min(0.35, g.you * 0.07);
      g.au += Math.max(-aiSpeed * dt, Math.min(aiSpeed * dt, aim - g.au));
      g.au = Math.max(-HW + PW, Math.min(HW - PW, g.au));
      if (g.serve > 0) {
        g.serve -= dt;
      } else {
        g.u += g.vu * dt;
        g.v += g.vv * dt;
        if (Math.abs(g.u) > HW - PR) { g.u = Math.sign(g.u) * (HW - PR); g.vu *= -1; tick(520); }
        const hit = (pu, towardSign) => {
          g.vv = -towardSign * Math.min(4.3, Math.abs(g.vv) * 1.07 + 0.08);
          g.vu = Math.max(-3.2, Math.min(3.2, g.vu * 0.6 + (g.u - pu) * 9));
          tick(towardSign > 0 ? 760 : 640);
        };
        const lineMine = HL - 0.1 - 0.035 - PR, lineHis = -(HL - 0.1 - 0.035 - PR);
        if (g.vv > 0 && g.v >= lineMine && g.v < lineMine + 0.12 && Math.abs(g.u - g.pu) < PW + PR) { g.v = lineMine; hit(g.pu, 1); }
        if (g.vv < 0 && g.v <= lineHis && g.v > lineHis - 0.12 && Math.abs(g.u - g.au) < PW + PR) { g.v = lineHis; hit(g.au, -1); }
        if (Math.abs(g.v) > HL + 0.06) {
          const youScored = g.v < 0;
          if (youScored) g.you++; else g.him++;
          audio.sfx('score', { volume: 0.3 });
          drawBoard();
          if (g.you >= HOCKEY_TARGET || g.him >= HOCKEY_TARGET) { finish(); return; }
          say(youScored
            ? ['A LUCKY ANGLE.', 'POINT TO THE HUMAN. NOTED.', 'MY CLAW SLIPPED.'][g.you % 3]
            : ['POINT TO THE MACHINE.', 'TOO SLOW, HUMAN.', 'I SAW THAT COMING. I SEE EVERYTHING COMING.'][g.him % 3]);
          serve(youScored ? -1 : 1);
        }
      }
    }

    interactables.push({
      kind: 'hockey', scale: 1.45, omni: true,
      position: new THREE.Vector3(TX, 0, TZ), forward: new THREE.Vector3(0, 0, 1),
      screenCenter: new THREE.Vector3(TX, TOPY, TZ),
      prompt: () => ({ title: 'PLAY AIR HOCKEY', sub: `FIRST TO ${HOCKEY_TARGET} VS PRIZETRON-80 // YOU ${F().hockey.wins}–${F().hockey.losses}` }),
      use() { start(); return true; }
    });

    return {
      start,
      state: g,
      // idle animation + keeping the meshes on the simulation
      animate(dt, t) {
        mine.position.x = g.pu;
        his.position.x = g.au;
        puck.position.set(g.u, 0.014, g.v);
        remote.position.x = g.au * 0.5;
        remote.position.y = 0.5 + Math.sin(t * 2.1) * 0.02;
        head.rotation.y = Math.max(-0.5, Math.min(0.5, (g.u - g.au) * 0.9));
        if (!g.on) {       // nobody playing: the claw idles from side to side
          g.au = Math.sin(t * 0.6) * 0.25;
          g.pu *= 0.96;
        }
      }
    };
  })();

  // ───────────────────────────────────────────────────────────────────────
  // PHOTO MODE — P (or the PHOTO button): frame a shot, take home a postcard
  // ───────────────────────────────────────────────────────────────────────
  const photo = { fov: 72, baseFov: camera.fov, url: null, blob: null };
  function stopPhoto() {
    document.body.classList.remove('gc-photo');
    camera.fov = photo.baseFov;
    camera.updateProjectionMatrix();
    const arms = ctx.arms();
    if (arms) arms.left.visible = arms.right.visible = true;
  }
  function startPhoto() {
    if (!beginBusy({
      kind: 'photo',
      cancel: stopPhoto,
      key(e, down) {
        if (!down) return;
        const c = e.code;
        if (c === 'KeyW' || c === 'ArrowUp') { photo.fov = Math.max(28, photo.fov - 4); e.preventDefault(); }
        else if (c === 'KeyS' || c === 'ArrowDown') { photo.fov = Math.min(95, photo.fov + 4); e.preventDefault(); }
        else if (c === 'KeyE' || c === 'Enter' || c === 'Space') { e.preventDefault(); snap(); }
        else if (c === 'KeyP' || c === 'KeyQ' || c === 'Escape' || c === 'Backspace') { e.preventDefault(); endBusy(); }
      },
      mouse(dx, dy) {
        const s = 0.0022 * (photo.fov / 72);
        player.yaw -= dx * s;
        player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - dy * s));
      },
      click() { snap(); },
      update() {
        camera.rotation.set(player.pitch, player.yaw, 0);
        if (Math.abs(camera.fov - photo.fov) > 0.05) {
          camera.fov += (photo.fov - camera.fov) * 0.25;
          camera.updateProjectionMatrix();
        }
      }
    })) return;
    photo.fov = photo.baseFov = camera.fov;
    document.body.classList.add('gc-photo');
    const arms = ctx.arms();
    if (arms) arms.left.visible = arms.right.visible = false;
    showActivity(isTouch
      ? 'DRAG to aim <button type="button" data-act="snap">SNAP</button><button type="button" data-act="leave">EXIT</button>'
      : '<span>MOUSE</span> aim &nbsp;·&nbsp; <span>W / S</span> zoom &nbsp;·&nbsp; <span>CLICK</span> or <span>E</span> take the photo &nbsp;·&nbsp; <span>P</span> exit');
  }

  function snap() {
    // draw the frame now and copy it before the browser clears the buffer
    ctx.renderWorld();
    const src = ctx.canvas;
    const PW = 1200, PH = 820, M = 28, IH = 640;
    const cv = makeCanvas(PW, PH);
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#0a0716';
    c2.fillRect(0, 0, PW, PH);
    // cover-fit the shot into the picture window
    const iw = PW - M * 2, scale = Math.max(iw / src.width, IH / src.height);
    const sw = iw / scale, sh = IH / scale;
    c2.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, M, M, iw, IH);
    c2.strokeStyle = C.cyan;
    c2.lineWidth = 3;
    c2.strokeRect(M - 1.5, M - 1.5, iw + 3, IH + 3);
    c2.textBaseline = 'middle';
    c2.textAlign = 'left';
    c2.font = '900 44px Orbitron, "Arial Black", sans-serif';
    chromaText(c2, 'GREETINGS FROM THE GLITCHCADE', M, IH + M + 52, 3, C.text, C.purple);
    const w = Wallet.get();
    c2.font = '22px "Share Tech Mono", monospace';
    c2.fillStyle = C.amber;
    c2.fillText(`${todayStr()}  //  ${onlineCount(F())}/${TOTAL_CABINETS} CABINETS ONLINE  //  ${w.prizes.length}/${PRIZES.length} PRIZES  //  ◎ ${w.coins}`, M, IH + M + 108);
    if (assets.eyeNeutral) c2.drawImage(assets.eyeNeutral, PW - M - 112, IH + M + 18, 112, 112);
    const f = F();
    f.photos++;
    store.save();
    audio.sfx('pulse', { volume: 0.35, rate: 1.6 });
    ctx.worldGlitch(true);
    cv.toBlob((blob) => {
      if (!blob) { ctx.toast('THE CAMERA JAMMED — TRY AGAIN.'); return; }
      if (photo.url) URL.revokeObjectURL(photo.url);
      photo.blob = blob;
      photo.url = URL.createObjectURL(blob);
      postcardEl.querySelector('img').src = photo.url;
      const save = $('gcPostSave');
      save.href = photo.url;
      save.download = `glitchcade-postcard-${todayStr()}.png`;
      const file = typeof File === 'function' ? new File([blob], save.download, { type: 'image/png' }) : null;
      $('gcPostShare').style.display = file && navigator.canShare && navigator.canShare({ files: [file] }) ? '' : 'none';
      photo.file = file;
      postcardEl.classList.add('on');
      // free the mouse for the buttons; on desktop that drops to the pause screen behind the card
      const locked = ctx.hasPointerLock();
      endBusy();
      if (locked) ctx.releasePointer();
    }, 'image/png');
  }
  $('gcPostClose').addEventListener('click', () => postcardEl.classList.remove('on'));
  postcardEl.addEventListener('click', (e) => { if (e.target === postcardEl) postcardEl.classList.remove('on'); });
  $('gcPostShare').addEventListener('click', () => {
    if (!photo.file) return;
    navigator.share({ files: [photo.file], title: 'Greetings from the Glitchcade' }).catch(() => {});
  });
  function togglePhoto() {
    if (busy && busy.kind === 'photo') endBusy();
    else if (ctx.state === 'explore') startPhoto();
  }
  photoBtn.addEventListener('click', togglePhoto);
  activityEl.addEventListener('click', (e) => {
    const act = e.target && e.target.dataset ? e.target.dataset.act : null;
    if (act === 'leave') endBusy();
    if (act === 'snap') snap();
  });

  // ───────────────────────────────────────────────────────────────────────
  // FRAME UPDATE
  // ───────────────────────────────────────────────────────────────────────
  let fragT = 0, gauntletT = 0, dayCheck = 0;
  animated.push((dt, t) => {
    patronUniforms.uTime.value = t;
    updateEye(dt);
    updatePatrons(dt);
    gauge.update(dt, t);
    ball.update(dt, t);
    staff.update(dt);
    hockey.animate(dt, t);
    // repaired cabinets' shared attract screen
    fragT += dt;
    if (fragT > 1 / (isTouch ? 8 : 12)) {
      if (ctx.insideFactor() > 0 && deadCabs.some((c) => c.fragment && ctx.canSee(c.screenCenter, 0.6, c.screenNormal, 22))) fragScreen.draw(fragT);
      fragT = 0;
    }
    // the gauntlet cabinet twitches while you're in its room
    gauntletT += dt;
    if (gauntletT > (isTouch ? 0.25 : 0.16) && player.pos.x > hx) { gauntletT = 0; if (ctx.canSee(gauntletCab.entry.screenCenter, 0.7, gauntletCab.entry.screenNormal, 14)) gauntletCab.draw(); }
    if (gauntletCab.entry.eyeSprite) gauntletCab.entry.eyeSprite.material.opacity = 0.7 + Math.sin(t * 2.2) * 0.2;
    // sparks
    for (let i = sparkPool.length - 1; i >= 0; i--) {
      const s = sparkPool[i];
      s.life -= dt;
      s.v.y -= 6 * dt;
      s.m.position.addScaledVector(s.v, dt);
      if (s.life <= 0) { scene.remove(s.m); s.m.geometry.dispose(); sparkPool.splice(i, 1); }
    }
    // a capsule toy pops when it lands on the counter
    toyModels.forEach((tm) => {
      if (tm.pop > 0) { tm.pop = Math.max(0, tm.pop - dt * 1.6); tm.g.scale.setScalar(1 + Math.sin(tm.pop * Math.PI) * 0.9); }
      if (tm.g.visible) tm.g.rotation.y = t * 0.6;
    });
    // midnight: a new daily, capsule and request
    dayCheck += dt;
    if (dayCheck > 20) {
      dayCheck = 0;
      if (store.data.daily.date !== todayStr()) { F(); store.save(); dailyBoard.draw(); refreshOnline(); }
    }
  });

  function refreshAll() {
    gauge.refresh();
    marquee.refresh();
    ball.refresh();
    staff.refresh();
    dailyBoard.draw();
    refreshOnline();
  }
  refreshAll();
  ensureRequest();
  recordScore('glitch-pong', gpData().longestRally || 0);   // a returning player's rally is already on the board

  // Every light is in place now: remember how bright each one is for Kernel Panic.
  worldLights.forEach((l) => lightBase.push([l, l.intensity]));
  if (ctx.carpetMat()) carpetBase = ctx.carpetMat().emissiveIntensity;

  // ───────────────────────────────────────────────────────────────────────
  // What glitchcade.js calls
  // ───────────────────────────────────────────────────────────────────────
  return {
    store,
    // input, routed here while gameState is 'busy'
    key(e, down) { if (busy && busy.key) busy.key(e, down); },
    mouse(dx, dy) { if (busy && busy.mouse) busy.mouse(dx, dy); },
    click() { if (busy && busy.click) busy.click(); },
    updateBusy(dt) { if (busy && busy.update) busy.update(dt); },
    coversWorld() { return !!(busy && busy.covers); },
    menuOpen() { return !!(busy && busy.kind === 'list'); },
    // Something is moving that deserves full frame rate even though the player is standing still.
    animating() { return !!eye.active || sparkPool.length > 0 || ball.moving() || staff.moving; },
    hidesArms() { return !!busy && (busy.kind === 'hockey' || busy.kind === 'photo'); },
    // The pointer lock was lost (Esc): drop whatever was going on. A ROM
    // fragment never holds the lock, so it carries on.
    cancelOnUnlock() {
      if (!busy || busy.kind === 'fragment') return false;
      endBusy();
      return true;
    },
    openJukebox,
    togglePhoto,
    robotLines,
    onWallet() {
      // a save import replaces the floor record under us: reload and redress the room
      if (store.sync()) {
        deadCabs.forEach(applyRepairLook);
        refreshToys();
        audio.setOwnedPacks(F().packs);
        gauntletCab.draw();
      }
      refreshAll();
      ctx.refocus();
    },
    // Back on the floor after a game.
    onGameExit(cab) {
      const p = gpData();
      if (recordScore('glitch-pong', p.longestRally || 0)) ctx.toast(`NEW LONGEST RALLY ON THE BOARD: ${p.longestRally} HITS`);
      if (cab === gauntletCab.entry) {
        if (cab.game === 'glitch-pong') gauntletCab.afterGlitchPong();
        else gauntletCab.settle();
      }
      const st = dailyState();
      if (st.done && !F().daily.claimed && !dailyNoticed) {
        dailyNoticed = true;
        ctx.setRobotPending(`YOUR DAILY GLITCH IS COMPLETE. CLAIM ${st.ch.reward} COINS AT THE BOARD BY THE DOOR.`);
      }
      refreshAll();
    },
    // Breakpoint (in its frame) reporting a finished run or a dead Eye.
    onBreakpointReport(data, cab) {
      if (data.event === 'run' && Number(data.score) > 0) recordScore('breakpoint', Math.floor(Number(data.score)));
      if (data.event === 'eye-defeated' && data.mode === 'bossrush' && cab === gauntletCab.entry) gauntletCab.eyeDefeatedInBreakpoint();
    },
    // for tests and the console
    debug: {
      startEyeEvent, endEyeEvent, eye, patrons, hockey, fragments, openList, list: () => list, busy: () => busy,
      playFragment, deadCabs, dailyState, gauntletCab, staff, ball, scorePages, ROOM, swapCabinets, recordScore,
      startPhoto, snap, scoreFeed, replayFeed
    }
  };
}

let dailyNoticed = false;
