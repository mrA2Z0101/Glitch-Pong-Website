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
  if (
    typeof window.chrome !== "undefined" &&
    window.chrome.runtime &&
    typeof window.chrome.runtime.getURL === "function"
  ) {
    try {
      return window.chrome.runtime.getURL(path);
    } catch (error) {
      console.warn("Glitch Pong asset URL fallback:", error);
    }
  }
  return path;
}

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
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;overflow:hidden;background:rgba(4,8,18,0.10);";

    const canvas = d.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    overlay.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const hud = d.createElement("div");
    hud.style.cssText = [
      "position:absolute","top:14px","left:50%","transform:translateX(-50%)",
      "padding:10px 18px","border-radius:12px","background:rgba(7,14,30,0.88)",
      "border:1px solid rgba(90,220,255,0.22)","color:#e8fbff","font:700 14px monospace",
      "letter-spacing:.08em","text-align:center","min-width:420px","box-shadow:0 0 24px rgba(90,220,255,0.12)"
    ].join(";");
    overlay.appendChild(hud);
    hud.style.display = "none";

    const help = d.createElement("div");
    help.style.cssText = [
      "position:absolute","bottom:16px","left:50%","transform:translateX(-50%)",
      "padding:8px 14px","border-radius:999px","background:rgba(7,14,30,0.78)",
      "border:1px solid rgba(90,220,255,0.18)","color:#9fc8d6","font:12px monospace"
    ].join(";");
    help.textContent = helpText + " // Esc quit // R restart";
    overlay.appendChild(help);
    help.style.display = "none";

    const closeBtn = d.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = [
      "position:absolute","top:16px","right:16px","width:40px","height:40px","border-radius:999px",
      "border:1px solid rgba(113,239,255,0.22)","background:rgba(6,10,18,0.44)",
      "backdrop-filter:blur(6px)","color:#dffcff","font:700 18px monospace","cursor:pointer","pointer-events:auto",
      "box-shadow:0 0 16px rgba(113,239,255,0.08)"
    ].join(";");
    overlay.appendChild(closeBtn);

    function sizeCanvas() {
      canvas.width = w.innerWidth;
      canvas.height = w.innerHeight;
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

    let leftY = canvas.height / 2 - 70;
    let rightY = canvas.height / 2 - 70;
    const paddleH = 140;
    const paddleW = 22;
    const leftX = 20;
    const rightX = canvas.width - 42;
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
    let roundFrozen = true;
    let pendingLaunchDir = 1;
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

    const bluePaddleImage = new Image();
    const redPaddleImage = new Image();
    const countdown3Image = new Image();
    const countdown2Image = new Image();
    const countdown1Image = new Image();
    const countdownGoImage = new Image();
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

    let aiDashDecisionCooldown = 0;
    let menuDemoResetCooldown = 0;

    // Final-score cinematic: freeze-frame + effects only after the winning point is confirmed.
    let finalPointSlowMo = false;
    let finalPointSlowMoMix = 0;
    let finalScoreCinematic = false;
    let finalScoreCinematicTimer = 0;
    let finalScoreSide = null;
    let finalScoreTrailSnapshot = [];
    let finalScoreBallSnapshot = null;

    const pongAudio = (() => {
      const SOUND_FILES = {
        baseMusic: "sounds/Background Music (Base Layer).mp3",
        heatLayer: "sounds/Heat 0-99.mp3",
        clutchLayer: "sounds/Boss Fight Music.mp3",
        paddleHit: "sounds/Paddle Hit Sound.mp3",
        wallBounce: "sounds/Wall Bounce Sound.mp3",
        score: "sounds/Score Sound.mp3",
        gameStart: "sounds/Game Start.mp3",
        glitchPulse: "sounds/Glitch Pulse.mp3",
        dashActivation: "sounds/Dash Activation.mp3",
        dashReady: "sounds/Dash Cooldown Ready.mp3",
        teleport: "sounds/Teleport Sound.mp3",
        juke: "sounds/Juke Sound.mp3",
        critical: "sounds/Critical Moment (high heat + long rally).mp3",
        menuMusic: "sounds/Menu Music.mp3",
        buttonHover: "sounds/Button Hover.mp3",
        countdown3: "sounds/3.mp3",
        countdown2: "sounds/2.mp3",
        countdown1: "sounds/1.mp3",
        countdownGo: "sounds/GO.mp3",
        countdown: "sounds/Countdown.mp3",
        introVoice: "sounds/GLITCH PONG.mp3"
      };

      const loops = new Map();
      const oneShots = new Map();
      let musicStarted = false;
      let primed = false;
      let duckAmount = 0;
      let duckUntil = 0;
      let menuActive = false;
      let musicEnabled = true;
      let sfxEnabled = true;
      let menuGestureBootstrapped = false;
      let introVoiceBootstrapped = false;
      let introVoicePlayedForCurrentMenu = false;
      let introVoiceTimerId = null;

      function soundUrl(file) {
        try {
          return resolveAssetPath(file);
        } catch (error) {
          console.warn("Glitchcade Pong sound URL fallback:", error);
          return file;
        }
      }

      function getLoop(key, volume) {
        if (loops.has(key)) return loops.get(key);
        const audio = new Audio(soundUrl(SOUND_FILES[key]));
        audio.loop = true;
        audio.preload = "auto";
        audio.volume = volume;
        loops.set(key, audio);
        return audio;
      }

      function getOneShot(key, volume = 0.45) {
        if (oneShots.has(key)) return oneShots.get(key);
        const audio = new Audio(soundUrl(SOUND_FILES[key]));
        audio.loop = false;
        audio.preload = "auto";
        audio.volume = volume;
        oneShots.set(key, audio);
        return audio;
      }

      function duckMusic(amount = 0.45, duration = 420) {
        duckAmount = Math.max(duckAmount, Math.max(0, Math.min(0.9, amount)));
        duckUntil = Math.max(duckUntil, performance.now() + duration);
      }

      function playOneShot(key, { volume = 0.45, playbackRate = 1, duck = 0, duckDuration = 0 } = {}) {
        const file = SOUND_FILES[key];
        if (!file || !sfxEnabled) return;
        if (duck > 0 && duckDuration > 0) duckMusic(duck, duckDuration);
        const audio = new Audio(soundUrl(file));
        audio.preload = "auto";
        audio.volume = volume;
        audio.playbackRate = playbackRate;
        audio.play().catch(() => {});
      }

      function primeFromGesture() {
        if (primed) return;
        primed = true;

        const base = getLoop("baseMusic", 0.22);
        const heat = getLoop("heatLayer", 0);
        const clutch = getLoop("clutchLayer", 0);
        const menu = getLoop("menuMusic", 0);
        const introVoice = getOneShot("introVoice", 0.88);

        [base, heat, clutch].forEach((audio) => {
          const prevMuted = audio.muted;
          const prevVol = audio.volume;
          audio.muted = true;
          audio.volume = 0;
          const p = audio.play();
          if (p && typeof p.then === "function") {
            p.then(() => {
              audio.pause();
              audio.currentTime = 0;
              audio.muted = prevMuted;
              audio.volume = prevVol;
            }).catch(() => {
              audio.muted = prevMuted;
              audio.volume = prevVol;
            });
          } else {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = prevMuted;
            audio.volume = prevVol;
          }
        });

        menu.loop = true;
        menu.muted = true;
        menu.volume = 0;
        const menuPlay = menu.play();
        if (menuPlay && typeof menuPlay.then === "function") {
          menuPlay.then(() => {
            menuGestureBootstrapped = true;
          }).catch(() => {
            menuGestureBootstrapped = false;
            menu.pause();
            menu.currentTime = 0;
            menu.muted = false;
            menu.volume = 0;
          });
        } else {
          menuGestureBootstrapped = true;
        }

        introVoice.muted = true;
        introVoice.volume = 0;
        introVoice.currentTime = 0;
        const introPlay = introVoice.play();
        if (introPlay && typeof introPlay.then === "function") {
          introPlay.then(() => {
            introVoice.pause();
            introVoice.currentTime = 0;
            introVoice.muted = false;
            introVoice.volume = 0.88;
            introVoiceBootstrapped = true;
          }).catch(() => {
            introVoice.pause();
            introVoice.currentTime = 0;
            introVoice.muted = false;
            introVoice.volume = 0.88;
            introVoiceBootstrapped = false;
          });
        } else {
          introVoice.pause();
          introVoice.currentTime = 0;
          introVoice.muted = false;
          introVoice.volume = 0.88;
          introVoiceBootstrapped = true;
        }
      }

      function startMusic() {
        if (!musicEnabled) return;
        const base = getLoop("baseMusic", 0.22);
        const heat = getLoop("heatLayer", 0);
        const clutch = getLoop("clutchLayer", 0);
        const menu = getLoop("menuMusic", 0);
        const introVoice = getOneShot("introVoice", 0.88);
        menuActive = false;
        introVoicePlayedForCurrentMenu = false;
        menu.muted = false;
        if (!menu.paused) {
          menu.pause();
          menu.currentTime = 0;
        }
        introVoice.pause();
        introVoice.currentTime = 0;
        if (musicStarted) return;
        musicStarted = true;
        [base, heat, clutch].forEach((audio) => audio.play().catch(() => {}));
      }

      function stopAll() {
        menuActive = false;
        loops.forEach((audio) => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        });
        if (introVoiceTimerId) {
          clearTimeout(introVoiceTimerId);
          introVoiceTimerId = null;
        }
        oneShots.forEach((audio) => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        });
        musicStarted = false;
        menuGestureBootstrapped = false;
        introVoiceBootstrapped = false;
        introVoicePlayedForCurrentMenu = false;
      }

      function setIntensity(v) {
        const intensity = Math.max(0, Math.min(1, v));
        const now = performance.now();
        if (duckUntil > now) {
          duckAmount += (Math.max(duckAmount, 0.45) - duckAmount) * 0.18;
        } else {
          duckAmount += (0 - duckAmount) * 0.08;
        }

        const duckScale = 1 - Math.max(0, Math.min(0.85, duckAmount));
        const base = getLoop("baseMusic", 0.22);
        const heat = getLoop("heatLayer", 0);
        const clutch = getLoop("clutchLayer", 0);
        const menu = getLoop("menuMusic", 0);

        let baseTarget = 0.16 + intensity * 0.08;
        let heatTarget = 0;
        let clutchTarget = 0;
        let menuTarget = musicEnabled && menuActive ? 0.22 : 0;

        if (intensity < 0.45) {
          heatTarget = intensity * 0.12;
        } else if (intensity < 0.78) {
          heatTarget = 0.05 + ((intensity - 0.45) / 0.33) * 0.20;
        } else {
          const clutchMix = Math.min(1, (intensity - 0.78) / 0.22);
          heatTarget = (0.25 * (1 - clutchMix));
          clutchTarget = 0.05 + clutchMix * 0.32;
          baseTarget *= 1 - clutchMix * 0.28;
        }

        baseTarget *= duckScale;
        heatTarget *= duckScale;
        clutchTarget *= duckScale;
        menuTarget *= duckScale;

        if (!musicEnabled) {
          baseTarget = 0;
          heatTarget = 0;
          clutchTarget = 0;
          menuTarget = 0;
        }

        base.volume += (baseTarget - base.volume) * 0.08;
        heat.volume += (heatTarget - heat.volume) * 0.08;
        clutch.volume += (clutchTarget - clutch.volume) * 0.08;
        menu.volume += (menuTarget - menu.volume) * 0.08;
        if (!menuActive && menu.volume < 0.005 && !menu.paused) {
          menu.pause();
          menu.currentTime = 0;
        } else if (menuActive && menu.paused) {
          menu.play().catch(() => {});
        }
      }

      return {
        primeFromGesture,
        startMusic,
        stopAll,
        setIntensity,
        startMenuMusic() {
          menuActive = true;
          if (!musicEnabled) return;
          musicStarted = false;
          const base = getLoop("baseMusic", 0.22);
          const heat = getLoop("heatLayer", 0);
          const clutch = getLoop("clutchLayer", 0);
          const menu = getLoop("menuMusic", 0.22);
          const introVoice = getOneShot("introVoice", 0.88);

          [base, heat, clutch].forEach((audio) => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
          });

          menu.loop = true;
          menu.muted = false;
          if (menu.volume < 0.01) menu.volume = 0.22;

          if (menuGestureBootstrapped) {
            if (menu.paused) {
              menu.play().catch(() => {});
            }
          } else {
            const p = menu.play();
            if (p && typeof p.then === "function") {
              p.then(() => {
                menuGestureBootstrapped = true;
              }).catch(() => {});
            }
          }

          const reviveMenuMusic = () => {
            if (!menuActive) return;
            menu.play().catch(() => {});
          };
          document.addEventListener("pointerdown", reviveMenuMusic, { once: true, capture: true });
          document.addEventListener("keydown", reviveMenuMusic, { once: true, capture: true });

        },
        playIntroVoice() {
          if (!musicEnabled) return;
          const introVoice = getOneShot("introVoice", 0.88);
          if (introVoiceTimerId) {
            clearTimeout(introVoiceTimerId);
            introVoiceTimerId = null;
          }
          if (introVoicePlayedForCurrentMenu || !menuActive) return;
          introVoice.pause();
          try { introVoice.currentTime = 0; } catch (error) {}
          introVoice.muted = false;
          introVoice.volume = 0.88;
          const introPlay = introVoice.play();
          if (introPlay && typeof introPlay.then === "function") {
            introPlay.then(() => {
              introVoicePlayedForCurrentMenu = true;
              introVoiceBootstrapped = true;
            }).catch(() => {
              if (introVoiceBootstrapped) {
                try { introVoice.currentTime = 0; } catch (error) {}
                introVoice.play().then(() => {
                  introVoicePlayedForCurrentMenu = true;
                }).catch(() => {});
              }
            });
          } else {
            introVoicePlayedForCurrentMenu = true;
            introVoiceBootstrapped = true;
          }
        },
        stopMenuMusic() {
          menuActive = false;
          const menu = getLoop("menuMusic", 0.22);
          const introVoice = getOneShot("introVoice", 0.88);
          menu.muted = false;
          if (!menu.paused) {
            menu.pause();
            menu.currentTime = 0;
          }
          if (introVoiceTimerId) {
            clearTimeout(introVoiceTimerId);
            introVoiceTimerId = null;
          }
          introVoice.pause();
          try { introVoice.currentTime = 0; } catch (error) {}
          introVoicePlayedForCurrentMenu = false;
        },
        buttonHover() { playOneShot("buttonHover", { volume: 0.22, playbackRate: 0.98 + Math.random() * 0.04 }); },
        gameStart() { playOneShot("gameStart", { volume: 0.4, duck: 0.45, duckDuration: 900 }); },
        paddleHit() { playOneShot("paddleHit", { volume: 0.42, playbackRate: 0.96 + Math.random() * 0.1, duck: 0.12, duckDuration: 120 }); },
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
            const menu = getLoop("menuMusic", 0.22);
            const base = getLoop("baseMusic", 0.22);
            const heat = getLoop("heatLayer", 0);
            const clutch = getLoop("clutchLayer", 0);
            const introVoice = getOneShot("introVoice", 0.88);
            [menu, base, heat, clutch].forEach((audio) => {
              audio.pause();
              try { audio.currentTime = 0; } catch (error) {}
            });
            introVoice.pause();
            try { introVoice.currentTime = 0; } catch (error) {}
          } else if (menuActive) {
            this.startMenuMusic();
          } else if (modeSelected) {
            this.startMusic();
          }
        },
        setSfxEnabled(enabled) { sfxEnabled = !!enabled; }
      };
    })();

    bluePaddleImage.onload = () => { leftImageReady = true; };
    redPaddleImage.onload = () => { rightImageReady = true; };
    bluePaddleImage.src = BLUE_PADDLE_SRC;
    redPaddleImage.src = RED_PADDLE_SRC;
    countdown3Image.src = COUNTDOWN_3_SRC;
    countdown2Image.src = COUNTDOWN_2_SRC;
    countdown1Image.src = COUNTDOWN_1_SRC;
    countdownGoImage.src = COUNTDOWN_GO_SRC;
    state.listeners.push(() => pongAudio.stopAll());
    if (audioUserInitiated) pongAudio.primeFromGesture();

    function getHeatRatio() {
      return Math.max(0, Math.min(1, heat / HEAT_MAX));
    }

    function ownerColor(owner, alpha = 1) {
      if (owner === "blue") return `rgba(103,239,255,${alpha})`;
      if (owner === "red") return `rgba(255,79,216,${alpha})`;
      return `rgba(255,255,255,${alpha})`;
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
        state.shieldTimer = 360;
      } else if (type === "power") {
        state.powerStrikeReady = true;
      } else if (type === "split") {
        state.splitReady = true;
      }
      glitchPulse = Math.max(glitchPulse, 14);
      triggerCameraKick(owner === "blue" ? -8 : 8, 0, 0.012);
      pongAudio.glitch();
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
      [-0.22, 0.22].forEach((offset, idx) => {
        decoys.push({
          x: ballX + direction * 10,
          y: ballY + (idx === 0 ? -8 : 8),
          vx: Math.cos(baseAngle + offset) * speed * 0.96,
          vy: Math.sin(baseAngle + offset) * speed * 0.96,
          life: 42 + Math.floor(Math.random() * 12),
          maxLife: 64
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
      clearPowerStates();
      pongAudio.setIntensity(0);
    }

    function dashCooldownRatio(frames) {
      return Math.max(0, Math.min(1, frames / DASH_COOLDOWN_MAX));
    }

    function performPaddleDash(side, direction) {
      if (!direction) return;
      const heatRatio = getHeatRatio();
      const dashDistance = DASH_DISTANCE + heatRatio * 12;
      const dashKick = 8 + heatRatio * 8;
      if (side === "left") {
        if (leftDashCooldown > 0) return;
        leftY = clamp(leftY + direction * dashDistance, 0, canvas.height - paddleH);
        leftDashCooldown = Math.max(24, DASH_COOLDOWN_MAX - Math.floor(heatRatio * 10));
        leftDashTrail = [
          { x: leftX, y: leftY - direction * 18, life: 8 },
          { x: leftX, y: leftY - direction * 40, life: 12 },
          { x: leftX, y: leftY - direction * 62, life: 16 }
        ];
        glitchPulse = Math.max(glitchPulse, 8 + Math.floor(heatRatio * 8));
        triggerCameraKick(6 + heatRatio * 6, direction * dashKick * 0.45, 0.006 + heatRatio * 0.008);
        impactFreezeFrames = Math.max(impactFreezeFrames, 1);
        pongAudio.dash();
      } else if (side === "right") {
        if (rightDashCooldown > 0) return;
        rightY = clamp(rightY + direction * dashDistance, 0, canvas.height - paddleH);
        rightDashCooldown = Math.max(24, DASH_COOLDOWN_MAX - Math.floor(heatRatio * 10));
        rightDashTrail = [
          { x: rightX, y: rightY - direction * 18, life: 8 },
          { x: rightX, y: rightY - direction * 40, life: 12 },
          { x: rightX, y: rightY - direction * 62, life: 16 }
        ];
        glitchPulse = Math.max(glitchPulse, 8 + Math.floor(heatRatio * 8));
        triggerCameraKick(-(6 + heatRatio * 6), direction * dashKick * 0.45, 0.006 + heatRatio * 0.008);
        impactFreezeFrames = Math.max(impactFreezeFrames, 1);
        pongAudio.dash();
      }
    }

    function updateAiPaddle(side = "right", options = {}) {
      const isMenuDemo = !!options.isMenuDemo;
      const paddleY = side === "left" ? leftY : rightY;
      const paddleCenter = paddleY + paddleH / 2;
      const movingTowardPaddle = side === "left" ? vx < 0 : vx > 0;
      const courtEdge = side === "left" ? leftX + paddleW : rightX;
      const distanceToPaddle = Math.abs(ballX - courtEdge);
      const travelFrames = Math.max(1, distanceToPaddle / Math.max(1, Math.abs(vx || 1)));
      const predictedY = clamp(ballY + vy * Math.min(22, travelFrames), paddleH * 0.5, canvas.height - paddleH * 0.5);
      const retreatTarget = canvas.height * 0.5;
      const targetCenter = movingTowardPaddle ? predictedY : (predictedY * 0.25 + retreatTarget * 0.75);
      const smoothing = isMenuDemo ? 0.11 : (0.085 + getHeatRatio() * 0.02);
      const nextY = paddleY + (targetCenter - paddleCenter) * smoothing;

      if (side === "left") leftY = nextY;
      else rightY = nextY;

      const offset = targetCenter - paddleCenter;
      const dashWindow = movingTowardPaddle && distanceToPaddle < (isMenuDemo ? canvas.width * 0.22 : canvas.width * 0.18);
      const dashNeeded = Math.abs(offset) > paddleH * (isMenuDemo ? 0.23 : 0.30);

      if (dashWindow && dashNeeded && aiDashDecisionCooldown <= 0) {
        const direction = offset > 0 ? 1 : -1;
        performPaddleDash(side, direction);
        aiDashDecisionCooldown = isMenuDemo ? 14 : Math.max(12, 20 - Math.floor(getHeatRatio() * 8));
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

      if (ballY <= 10 || ballY >= canvas.height - 10) {
        vy *= -1;
        ballY = clamp(ballY, 10, canvas.height - 10);
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
      vy = (Math.random() * 4) - 2;
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

    function drawPaddle(x, y, img, isReady, glowColor, fillColor) {
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 30 + Math.max(0, glitchPulse * 0.35);

      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, paddleW, paddleH);

      if (isReady) {
        ctx.drawImage(img, x, y, paddleW, paddleH);
      }

      ctx.strokeStyle = glowColor;
      ctx.globalAlpha = 0.82;
      ctx.lineWidth = 1.75;
      ctx.strokeRect(x + 0.5, y + 0.5, paddleW - 1, paddleH - 1);
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
      drawSystemBackdrop(alpha);

      ctx.strokeStyle = "rgba(86,224,255,0.18)";
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

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
          const shieldAlpha = 0.14 + (powerState.blue.shieldTimer / 360) * 0.12;
          ctx.fillStyle = `rgba(103,239,255,${shieldAlpha})`;
          ctx.fillRect(leftX - 8, leftY - 12, paddleW + 16, paddleH + 24);
        }
        if (powerState.red.shieldTimer > 0) {
          const shieldAlpha = 0.14 + (powerState.red.shieldTimer / 360) * 0.12;
          ctx.fillStyle = `rgba(255,79,216,${shieldAlpha})`;
          ctx.fillRect(rightX - 8, rightY - 12, paddleW + 16, paddleH + 24);
        }

        drawPaddle(leftX, leftY, bluePaddleImage, leftImageReady, "rgba(0,255,255,1)", "#00cfff");
        drawPaddle(rightX, rightY, redPaddleImage, rightImageReady, "rgba(255,80,120,1)", "#ff4d6d");

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

        for (let i = ballTrail.length - 1; i >= 0; i--) {
          const t = ballTrail[i];
          const progress = (ballTrail.length - i) / (ballTrail.length + 1);
          const size = (10 + heatRatio * 0.8) * (1 - progress * 0.25);
          const opacity = (0.05 + progress * 0.15) * (1 + heatRatio * 0.35);
          ctx.beginPath();
          ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${opacity})`;
          ctx.shadowColor = `rgba(255,255,255,${0.3 * (1 - progress)})`;
          ctx.shadowBlur = (14 + heatRatio * 6) * (1 - progress);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        for (let i = 0; i < decoys.length; i++) {
          const decoy = decoys[i];
          const lifeRatio = Math.max(0, decoy.life / decoy.maxLife);
          ctx.beginPath();
          ctx.arc(decoy.x, decoy.y, (8 + heatRatio * 0.6) * (0.92 + lifeRatio * 0.18), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${0.08 + lifeRatio * 0.12})`;
          ctx.shadowColor = `rgba(255,79,216,${0.10 + lifeRatio * 0.18})`;
          ctx.shadowBlur = 10 + lifeRatio * 12;
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

        ctx.beginPath();
        ctx.arc(ballX, ballY, 10 + heatRatio * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = ballOwner === "blue" ? "#67efff" : ballOwner === "red" ? "#ff4fd8" : "#ffffff";
        ctx.shadowColor = ownerColor(ballOwner, 0.75 + heatRatio * 0.2);
        ctx.shadowBlur = 22 + heatRatio * 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        if (heatRatio > 0.15) {
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

    function render() {
      drawArenaBase(0.18, true);
      let status = twoPlayerMode ? "2P" : "1P";
      if (gameOver) status += " // MATCH OVER";
      else if (roundFrozen && modeSelected) status += " // RELAUNCH";
      const heatDisplay = Math.round(heat);
      const comboDisplay = combo > 1 ? ` // COMBO: <span style="color:#ff8feb">x${combo}</span>` : "";
      const clutchDisplay = clutchMode ? ' // <span style="color:#ff637d">CLUTCH MODE</span>' : "";
      const ownerDisplay = ballOwner === "blue" ? '<span style="color:#67efff">BLUE</span>' : ballOwner === "red" ? '<span style="color:#ff8fab">RED</span>' : '<span style="color:#f3f6ff">NEUTRAL</span>';
      const powerupLabel = arenaPowerup ? (arenaPowerup.type === "shield" ? "PHASE SHIELD" : arenaPowerup.type === "power" ? "POWER STRIKE" : "SPLIT BALL") : "NONE";
      const leftFx = `${powerState.blue.shieldTimer > 0 ? 'SHIELD ' : ''}${powerState.blue.powerStrikeReady ? 'STRIKE ' : ''}${powerState.blue.splitReady ? 'SPLIT' : ''}`.trim() || 'NONE';
      const rightFx = `${powerState.red.shieldTimer > 0 ? 'SHIELD ' : ''}${powerState.red.powerStrikeReady ? 'STRIKE ' : ''}${powerState.red.splitReady ? 'SPLIT' : ''}`.trim() || 'NONE';
      const leftDashReady = leftDashCooldown <= 0 ? "READY" : `${Math.ceil(leftDashCooldown / 60 * 10) / 10}s`;
      const rightDashReady = rightDashCooldown <= 0 ? "READY" : `${Math.ceil(rightDashCooldown / 60 * 10) / 10}s`;
      const dashText = twoPlayerMode
        ? ` // L-DASH: <span style="color:#7ef9ff">${leftDashReady}</span> // R-DASH: <span style="color:#ff8fab">${rightDashReady}</span>`
        : ` // DASH: <span style="color:#7ef9ff">${leftDashReady}</span>`;
      const slowMoDisplay = finalScoreCinematic ? ' // <span style="color:#ffd27a">FINAL SCORE CAM</span>' : '';
      rallyHeatAudio += (getHeatRatio() - rallyHeatAudio) * 0.08;
      pongAudio.setIntensity(rallyHeatAudio);
      updateHUD(`TRUE DOM PONG // LEFT: <span style="color:#7ef9ff">${leftScore}</span> // RIGHT: <span style="color:#ff8fab">${rightScore}</span> // HEAT: <span style="color:#ffd27a">${heatDisplay}%</span> // OWNER: ${ownerDisplay} // ORB: <span style="color:#ffd27a">${powerupLabel}</span>${comboDisplay}${dashText} // L-FX: <span style="color:#67efff">${leftFx}</span> // R-FX: <span style="color:#ff8fab">${rightFx}</span>${clutchDisplay}${slowMoDisplay} // ${status}`);

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
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const winnerColor = winner === "LEFT" ? "#67efff" : "#ff8fab";
        ctx.textAlign = "center";
        ctx.shadowColor = winnerColor;
        ctx.shadowBlur = 28;
        ctx.fillStyle = winnerColor;
        ctx.font = "bold 56px monospace";
        ctx.fillText(`${winner} PLAYER WINS`, canvas.width / 2, canvas.height / 2 - 18);

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#f4fbff";
        ctx.font = "bold 22px monospace";
        ctx.fillText(`FIRST TO ${WIN_SCORE}`, canvas.width / 2, canvas.height / 2 + 22);
        ctx.fillStyle = "#ffd27a";
        ctx.font = "bold 18px monospace";
        ctx.fillText("PRESS R TO RESTART", canvas.width / 2, canvas.height / 2 + 58);
        ctx.restore();
      }
    }

    const settingsPanel = document.createElement("div");
    settingsPanel.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "z-index:2147483648",
      "width:min(720px, 88vw)",
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
      <div style="text-align:center;font:bold 28px/1.1 monospace;letter-spacing:.14em;color:#71efff;margin-bottom:18px;text-shadow:0 0 18px rgba(113,239,255,.15);">CONTROLS</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;">
        <div style="padding:16px;border:1px solid rgba(113,239,255,.16);border-radius:16px;background:rgba(113,239,255,.05);">
          <div style="font:bold 18px/1.2 monospace;color:#71efff;margin-bottom:10px;letter-spacing:.08em;">PLAYER 1</div>
          <div><span style="color:#ffd27a;">W</span> = Move Up</div>
          <div><span style="color:#ffd27a;">S</span> = Move Down</div>
          <div><span style="color:#ffd27a;">Left Shift + W</span> = Dash Up</div>
          <div><span style="color:#ffd27a;">Left Shift + S</span> = Dash Down</div>
        </div>
        <div style="padding:16px;border:1px solid rgba(255,143,171,.16);border-radius:16px;background:rgba(255,143,171,.05);">
          <div style="font:bold 18px/1.2 monospace;color:#ff8fab;margin-bottom:10px;letter-spacing:.08em;">PLAYER 2</div>
          <div><span style="color:#ffd27a;">↑</span> = Move Up</div>
          <div><span style="color:#ffd27a;">↓</span> = Move Down</div>
          <div><span style="color:#ffd27a;">Right Shift + ↑</span> = Dash Up</div>
          <div><span style="color:#ffd27a;">Right Shift + ↓</span> = Dash Down</div>
        </div>
      </div>
      <div style="margin-top:18px;padding:14px 16px;border:1px solid rgba(255,255,255,.10);border-radius:16px;background:rgba(255,255,255,.03);">
        <div><span style="color:#ffd27a;">Esc</span> = Back / Pause</div>
        <div><span style="color:#ffd27a;">R</span> = Restart Match</div>
        <div><span style="color:#ffd27a;">Music Note</span> = Toggle Music</div>
        <div><span style="color:#ffd27a;">Speaker</span> = Toggle Sound Effects</div>
      </div>
      <button type="button" aria-label="Back" style="margin:22px auto 0;display:block;padding:12px 28px;border-radius:14px;border:1px solid rgba(103,239,255,0.28);background:rgba(9,18,34,0.94);color:#eafcff;font:bold 16px monospace;letter-spacing:.12em;cursor:pointer;">BACK</button>
    `;
    const settingsBackBtn = settingsPanel.querySelector("button");

    const pauseMenu = document.createElement("div");
    pauseMenu.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "z-index:2147483649",
      "width:min(980px, 96vw)",
      "aspect-ratio:16 / 9",
      "background:url('" + PAUSE_MENU_SRC + "') center/100% 100% no-repeat",
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

    function refreshPauseAudioIndicators() {
      pauseMusicState.textContent = pongAudio.isMusicEnabled() ? "ON" : "OFF";
      pauseSfxState.textContent = pongAudio.isSfxEnabled() ? "ON" : "OFF";
      pauseMusicState.style.opacity = pongAudio.isMusicEnabled() ? "1" : "0.62";
      pauseSfxState.style.opacity = pongAudio.isSfxEnabled() ? "1" : "0.62";
    }

    function showPauseMenu() {
      if (currentScreen !== "game") return;
      isPaused = true;
      pauseMenu.style.display = "block";
      refreshPauseAudioIndicators();
      hud.style.display = "none";
      help.style.display = "none";
    }

    function hidePauseMenu() {
      pauseMenu.style.display = "none";
      if (currentScreen === "game") {
        isPaused = false;
        hud.style.display = "block";
        help.style.display = "block";
      }
    }

    const mainMenu = document.createElement("div");
    mainMenu.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "z-index:2147483647",
      "width:min(980px, 96vw)",
      "aspect-ratio:16 / 9",
      "background:url('" + MAIN_MENU_SRC + "') center/100% 100% no-repeat",
      "pointer-events:auto",
      "overflow:hidden"
    ].join(";");

    const modeMenu = document.createElement("div");
    modeMenu.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "z-index:2147483647",
      "width:min(980px, 96vw)",
      "aspect-ratio:16 / 9",
      "background:url('" + PONG_MENU_SRC + "') center/100% 100% no-repeat",
      "pointer-events:auto",
      "overflow:hidden"
    ].join(";");

    const glitchLayer = document.createElement("div");
    glitchLayer.style.cssText = [
      "position:absolute",
      "inset:0",
      "pointer-events:none",
      "mix-blend-mode:screen"
    ].join(";");
    glitchLayer.innerHTML = '<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 4px);opacity:.28;"></div>';
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

    mainMenu.appendChild(playBtn);
    mainMenu.appendChild(settingsBtn);
    overlay.appendChild(settingsPanel);

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
        if (!modeSelected && overlay.contains(modeMenu)) {
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

    [playBtn, settingsBtn, settingsBackBtn, player1Btn, player2Btn, pauseResumeBtn, pauseQuitBtn, pauseMusicBtn, pauseSfxBtn].forEach((btn) => {
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

    modeMenu.appendChild(player1Btn);
    modeMenu.appendChild(player2Btn);

    let menuAudioRevived = false;
    let menuAudioUnlockBound = false;

    function bindMenuAudioUnlock() {
      if (menuAudioUnlockBound) return;
      menuAudioUnlockBound = true;

      const unlock = () => {
        pongAudio.primeFromGesture();
        pongAudio.startMenuMusic();

        if (!menuAudioRevived) {
          menuAudioRevived = true;
          addTimer(window.setTimeout(() => {
            pongAudio.playIntroVoice();
          }, 420));
        }

        document.removeEventListener("pointerdown", unlock, true);
        document.removeEventListener("keydown", unlock, true);
        document.removeEventListener("touchstart", unlock, true);
      };

      document.addEventListener("pointerdown", unlock, { capture: true, once: true });
      document.addEventListener("keydown", unlock, { capture: true, once: true });
      document.addEventListener("touchstart", unlock, { capture: true, passive: true, once: true });
    }

    function ensureMenuAudioAndIntro() {
      pongAudio.primeFromGesture();
      pongAudio.startMenuMusic();
      if (!menuAudioRevived) {
        menuAudioRevived = true;
        addTimer(window.setTimeout(() => {
          pongAudio.playIntroVoice();
        }, Math.min(420, introVoiceDelayMs)));
      }
    }

    [mainMenu, settingsPanel, playBtn, settingsBtn, settingsBackBtn, modeMenu, player1Btn, player2Btn, pauseMenu, pauseResumeBtn, pauseQuitBtn, pauseMusicBtn, pauseSfxBtn].forEach((node) => {
      node.addEventListener("pointerdown", ensureMenuAudioAndIntro, { capture: true });
      node.addEventListener("touchstart", ensureMenuAudioAndIntro, { capture: true, passive: true });
      node.addEventListener("keydown", ensureMenuAudioAndIntro, { capture: true });
    });

    modeMenu.addEventListener("mouseenter", () => {
      pongAudio.primeFromGesture();
      pongAudio.startMenuMusic();
    });

    function showMainMenu() {
      hud.style.display = "none";
      help.style.display = "none";
      if (!overlay.contains(mainMenu)) {
        overlay.appendChild(mainMenu);
        bindMenuAudioUnlock();
        if (audioUserInitiated) ensureMenuAudioAndIntro();
      }
    }

    function hideMainMenu() {
      if (overlay.contains(mainMenu)) overlay.removeChild(mainMenu);
      settingsPanel.style.display = "none";
    }

    function showModeMenu() {
      currentScreen = "mode";
      hud.style.display = "none";
      help.style.display = "block";
      if (!overlay.contains(modeMenu)) {
        overlay.appendChild(modeMenu);
        resetMenuDemo();
        triggerMenuGlitch();
        bindMenuAudioUnlock();
        if (audioUserInitiated) {
          ensureMenuAudioAndIntro();
        }
        scheduleAmbientMenuGlitch();
      }
    }

    function hideModeMenu() {
      if (overlay.contains(modeMenu)) overlay.removeChild(modeMenu);
      if (currentScreen === "mode") currentScreen = "main";
    }

    function beginMode(twoPlayers) {
      pongAudio.primeFromGesture();
      twoPlayerMode = !!twoPlayers;
      modeSelected = true;
      currentScreen = "game";
      isPaused = false;
      hideMainMenu();
      hideModeMenu();
      pauseMenu.style.display = "none";
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
      hud.style.display = "block";
      help.style.display = "block";
      startRoundCountdown();
    }

    function returnToMainMenu() {
      pauseMenu.style.display = "none";
      isPaused = false;
      modeSelected = false;
      twoPlayerMode = false;
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
      resetPositions();
      showMainMenu();
    }

    playBtn.addEventListener("click", () => {
      triggerMenuGlitch();
      hideMainMenu();
      showModeMenu();
    });

    settingsBtn.addEventListener("click", () => {
      triggerMenuGlitch();
      hideMainMenu();
      currentScreen = "settings";
      settingsPanel.style.display = "block";
    });

    settingsBackBtn.addEventListener("click", () => {
      triggerMenuGlitch();
      settingsPanel.style.display = "none";
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
      beginMode(false);
    });
    player2Btn.addEventListener("click", () => {
      triggerMenuGlitch();
      beginMode(true);
    });

    function renderWaitingScreen() {
      updateMenuDemo();
      drawArenaBase(0.28, true);
    }

    function loop() {
      breachFlashFrames = Math.max(0, breachFlashFrames - 1);

      if (!modeSelected) {
        renderWaitingScreen();
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
          cameraTargetZoom = 1.06;
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

      if (keys.w) leftY -= 8;
      if (keys.s) leftY += 8;

      if (twoPlayerMode) {
        if (keys.up) rightY -= 8;
        if (keys.down) rightY += 8;
      } else {
        updateAiPaddle("right");
      }

      leftY = clamp(leftY, 0, canvas.height - paddleH);
      rightY = clamp(rightY, 0, canvas.height - paddleH);

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
        heat = Math.max(0, heat - (0.045 + heatRatio * 0.035) + clutchBoost);

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

        const clutchVelocityScale = clutchMode ? 1.08 : 1;
        const roundTimeScale = 1;
        ballX += vx * clutchVelocityScale * roundTimeScale;
        ballY += vy * clutchVelocityScale * roundTimeScale;

        ballTrail.unshift({ x: ballX, y: ballY });
        if (ballTrail.length > ghostTrailLimit) ballTrail.pop();

        if (ballY <= 10 || ballY >= canvas.height - 10) {
          vy *= -1;
          pongAudio.wallBounce();
        }

        checkPowerupCollection();

        const leftShieldPad = powerState.blue.shieldTimer > 0 ? 18 : 0;
        const rightShieldPad = powerState.red.shieldTimer > 0 ? 18 : 0;

        if (ballX <= leftX + paddleW && ballY >= leftY - leftShieldPad && ballY <= leftY + paddleH + leftShieldPad) {
          const returnHeat = getHeatRatio();
          const leftState = powerState.blue;
          const strikeBoost = leftState.powerStrikeReady ? 0.22 : 0;
          vx = Math.abs(vx) * (1 + returnHeat * 0.035 + Math.min(combo * 0.01, 0.08) + strikeBoost);
          vy += (ballY - (leftY + paddleH / 2)) * 0.04;
          if (leftState.shieldTimer > 0) {
            vx *= 0.96;
            vy *= 0.98;
          }
          heat = Math.min(HEAT_MAX, heat + 12.5);
          rallyHits += 1;
          combo += 1;
          comboTimer = COMBO_MAX_TIME;
          ballOwner = "blue";
          glitchPulse = Math.max(glitchPulse, 8 + Math.min(10, Math.floor(returnHeat * 10)));
          triggerCameraKick(10 + returnHeat * 10, (Math.random() - 0.5) * (6 + returnHeat * 6), 0.008 + returnHeat * 0.012);
          impactFreezeFrames = Math.max(impactFreezeFrames, 1);
          pongAudio.paddleHit();
          if (leftState.powerStrikeReady) {
            leftState.powerStrikeReady = false;
            glitchPulse = Math.max(glitchPulse, 18);
            pongAudio.critical();
          }
          if (leftState.splitReady) {
            leftState.splitReady = false;
            spawnSplitDecoys(1);
          }
          if (heat >= 72 && rallyHits % 4 === 0) pongAudio.critical();
          applyBallInstability();
        }

        if (ballX >= rightX && ballY >= rightY - rightShieldPad && ballY <= rightY + paddleH + rightShieldPad) {
          const returnHeat = getHeatRatio();
          const rightState = powerState.red;
          const strikeBoost = rightState.powerStrikeReady ? 0.22 : 0;
          vx = -Math.abs(vx) * (1 + returnHeat * 0.035 + Math.min(combo * 0.01, 0.08) + strikeBoost);
          vy += (ballY - (rightY + paddleH / 2)) * 0.04;
          if (rightState.shieldTimer > 0) {
            vx *= 0.96;
            vy *= 0.98;
          }
          heat = Math.min(HEAT_MAX, heat + 12.5);
          rallyHits += 1;
          combo += 1;
          comboTimer = COMBO_MAX_TIME;
          ballOwner = "red";
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
          applyBallInstability();
        }

        if (ballX < 0) {
          rightScore += ballOwner === "blue" ? 2 : 1;
          if (rightScore >= WIN_SCORE) {
            rightScore = Math.max(rightScore, WIN_SCORE);
            startFinalScoreCinematic("RIGHT");
          } else {
            triggerScoreShake(1);
          }
        } else if (ballX > canvas.width) {
          leftScore += ballOwner === "red" ? 2 : 1;
          if (leftScore >= WIN_SCORE) {
            leftScore = Math.max(leftScore, WIN_SCORE);
            startFinalScoreCinematic("LEFT");
          } else {
            triggerScoreShake(-1);
          }
        }
      }

      scoreFlashFrames = Math.max(0, scoreFlashFrames - 1);
      glitchPulse = Math.max(0, glitchPulse - 1);

      render();
      state.raf = requestAnimationFrame(loop);
    }

    function handleEscapeAction() {
      if (currentScreen === "game") {
        if (isPaused) hidePauseMenu();
        else showPauseMenu();
        return;
      }
      if (currentScreen === "settings") {
        settingsPanel.style.display = "none";
        currentScreen = "main";
        showMainMenu();
        return;
      }
      if (currentScreen === "mode") {
        hideModeMenu();
        showMainMenu();
      }
    }

    addListener(document, "keydown", (e) => {
      pongAudio.primeFromGesture();
      const code = e.code || "";
      if (e.key === "Escape") {
        e.preventDefault();
        handleEscapeAction();
        return;
      }
      if (currentScreen !== "game" || isPaused) return;

      if (e.key === "w" || e.key === "W") keys.w = true;
      if (e.key === "s" || e.key === "S") keys.s = true;
      if (e.key === "ArrowUp") keys.up = true;
      if (e.key === "ArrowDown") keys.down = true;
      if (code === "ShiftLeft") keys.shiftLeft = true;
      if (code === "ShiftRight") keys.shiftRight = true;

      if (!e.repeat) {
        if ((code === "KeyW" && keys.shiftLeft) || (code === "ShiftLeft" && keys.w)) performPaddleDash("left", -1);
        if ((code === "KeyS" && keys.shiftLeft) || (code === "ShiftLeft" && keys.s)) performPaddleDash("left", 1);
        if (twoPlayerMode && ((code === "ArrowUp" && keys.shiftRight) || (code === "ShiftRight" && keys.up))) performPaddleDash("right", -1);
        if (twoPlayerMode && ((code === "ArrowDown" && keys.shiftRight) || (code === "ShiftRight" && keys.down))) performPaddleDash("right", 1);
      }

      if (e.key === "r" || e.key === "R") {
        leftScore = 0;
        rightScore = 0;
        gameOver = false;
        winner = null;
        finalScoreCinematic = false;
        finalScoreCinematicTimer = 0;
        finalScoreSide = null;
        finalScoreTrailSnapshot = [];
        finalScoreBallSnapshot = null;
        modeSelected = false;
        twoPlayerMode = false;
        roundFrozen = true;
        countdownActive = false;
        countdownPhaseIndex = -1;
        countdownFrame = 0;
        shakeFrames = 0;
        scoreFlashFrames = 0;
        glitchPulse = 0;
        resetPositions();
        showMainMenu();
      }
    }, true);

    addListener(document, "keyup", (e) => {
      const code = e.code || "";
      if (e.key === "w" || e.key === "W") keys.w = false;
      if (e.key === "s" || e.key === "S") keys.s = false;
      if (e.key === "ArrowUp") keys.up = false;
      if (e.key === "ArrowDown") keys.down = false;
      if (code === "ShiftLeft") keys.shiftLeft = false;
      if (code === "ShiftRight") keys.shiftRight = false;
    }, true);

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
  const playBtn = document.getElementById('playBtn');
  const playFullscreenBtn = document.getElementById('playFullscreenBtn');
  const hero = document.querySelector('.hero');
  const footerYear = document.getElementById('footerYear');
  let started = false;

  if (footerYear) footerYear.textContent = new Date().getFullYear();

  function startGame(requestFullscreen = false, userInitiated = false) {
    if (started || window.__glitchcadeCleanup) return;
    started = true;

    if (requestFullscreen && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    document.body.classList.add('game-live');
    if (hero) hero.classList.add('launching');

    injectGameById('true-dom-pong', {
      glitchFx: !hero,
      safetyMode: false,
      audioUserInitiated: !!userInitiated,
      introVoiceDelayMs: 3000,
      introVoiceStartAtMs: Date.now()
    });
  }

  playBtn?.addEventListener('click', () => startGame(false, true));
  playFullscreenBtn?.addEventListener('click', () => startGame(true, true));

  if (!playBtn && !playFullscreenBtn) {
    window.addEventListener('load', () => {
      startGame(false, false);
    }, { once: true });
  } else {
    document.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && !window.__glitchcadeCleanup) {
        event.preventDefault();
        startGame(false, true);
      }
    });
  }
})();
