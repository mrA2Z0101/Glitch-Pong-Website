// Trailer overlay layer, injected into the game page. Rendered per captured frame
// from the Node side via window.__ov.render(layers, frameIndex).
(() => {
  const css = `
  #__ovroot{position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:hidden;font-family:'Orbitron',sans-serif}
  #__ovroot .word{position:absolute;left:0;right:0;text-align:center;font-weight:900;color:#f4fbff;letter-spacing:.06em;
    text-shadow:-4px 0 0 rgba(255,40,200,.85),4px 0 0 rgba(0,230,255,.85),0 0 40px rgba(0,217,255,.55),0 0 90px rgba(255,79,216,.35)}
  #__ovroot .mono{position:absolute;left:0;right:0;text-align:center;font-family:'Share Tech Mono',monospace;color:#bff7ff;letter-spacing:.22em;
    text-shadow:0 0 14px rgba(0,217,255,.65)}
  #__ovroot .corner{position:absolute;font-family:'Share Tech Mono',monospace;color:#9ff3ff;letter-spacing:.18em;font-size:20px;
    padding:8px 14px;border:1px solid rgba(113,239,255,.45);background:rgba(3,10,20,.55);text-shadow:0 0 10px rgba(0,217,255,.6)}
  #__ovroot .alert{position:absolute;left:50%;transform:translateX(-50%);font-family:'Share Tech Mono',monospace;font-size:30px;letter-spacing:.24em;
    color:#ff5f7a;padding:12px 26px;border:2px solid rgba(255,80,110,.8);background:rgba(30,0,8,.62);text-shadow:0 0 16px rgba(255,60,90,.9);white-space:nowrap}
  #__ovroot .fill{position:absolute;inset:0}
  #__ovroot .logo{position:absolute;left:50%;top:50%;width:1000px;height:450px;background:url('assets/glitch_pong_main_menu.png') no-repeat;
    background-size:1778px 1000px;background-position:-389px -42px;transform:translate(-50%,-50%);filter:drop-shadow(0 0 30px rgba(0,217,255,.45)) drop-shadow(0 0 60px rgba(255,79,216,.35))}
  #__ovroot .eye{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
  #__ovroot .strip{position:absolute;left:0;right:0;text-align:center;font-family:'Share Tech Mono',monospace;color:#8fdcff;letter-spacing:.2em;font-size:21px}
  `;
  function rngFor(n) { let s = (n * 2654435761) >>> 0; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }
  const GLYPHS = '#%&@$!?/\\<>[]{}=+*01ｱｲｳｴｵｶｷ';
  function corrupt(text, amount, r) {
    return [...text].map((ch) => (ch !== ' ' && r() < amount ? GLYPHS[Math.floor(r() * GLYPHS.length)] : ch)).join('');
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function ensure() {
    let root = document.getElementById('__ovroot');
    if (!root) {
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      root = document.createElement('div'); root.id = '__ovroot'; document.body.appendChild(root);
    }
    return root;
  }
  // Each layer: {type, ...}. `t` = frames since layer start, `d` = layer duration in frames.
  const R = {
    word(L, r) {
      const t = L.t, d = L.d;
      const inF = 4, outF = 5;
      const s = t < inF ? 1.6 - 0.6 * (t / inF) : 1;
      const a = t > d - outF ? Math.max(0, (d - t) / outF) : 1;
      const jx = (t < 6 || r() < 0.12) ? (r() - 0.5) * 26 : 0;
      const txt = t < 3 ? corrupt(L.text, 0.5, r) : (r() < 0.06 ? corrupt(L.text, 0.2, r) : L.text);
      const size = L.size || 150;
      return `<div class="word" style="top:${L.y ?? 50}%;font-size:${size}px;transform:translate(${jx}px,-50%) scale(${s});opacity:${a}">${esc(txt)}</div>`;
    },
    typed(L, r) {
      const n = Math.min(L.text.length, Math.floor(L.t / (L.rate || 2)));
      const cursor = Math.floor(L.t / 8) % 2 ? '█' : '&nbsp;';
      const a = L.fade && L.t > L.d - L.fade ? Math.max(0, (L.d - L.t) / L.fade) : 1;
      return `<div class="mono" style="top:${L.y ?? 50}%;font-size:${L.size || 44}px;transform:translateY(-50%);opacity:${a}">${esc(L.text.slice(0, n))}${cursor}</div>`;
    },
    morph(L, r) { // text A corrupts into text B over the layer
      const p = Math.min(1, L.t / (L.d * 0.6));
      const mid = p < 0.5 ? corrupt(L.a, p * 1.6, r) : corrupt(L.b, (1 - p) * 1.6, r);
      const jx = (r() - 0.5) * 30 * Math.sin(p * Math.PI);
      return `<div class="mono" style="top:${L.y ?? 50}%;font-size:${L.size || 44}px;transform:translate(${jx}px,-50%);color:${p > 0.5 ? '#ff7a95' : '#bff7ff'}">${esc(mid)}</div>`;
    },
    corner(L) {
      const a = L.t < 4 ? L.t / 4 : L.t > L.d - 4 ? Math.max(0, (L.d - L.t) / 4) : 1;
      const pos = L.pos === 'tr' ? 'top:70px;right:40px' : L.pos === 'bl' ? 'bottom:60px;left:40px' : L.pos === 'br' ? 'bottom:60px;right:40px' : 'top:70px;left:40px';
      return `<div class="corner" style="${pos};opacity:${a};font-size:${L.size || 20}px">${esc(L.text)}</div>`;
    },
    alert(L, r) {
      const blink = Math.floor(L.t / 5) % 2 === 0 || L.t > 12;
      return `<div class="alert" style="top:${L.y ?? 20}%;opacity:${blink ? 1 : 0.15};font-size:${L.size || 30}px">${esc(L.text)}</div>`;
    },
    fill(L) { return `<div class="fill" style="background:${L.color};opacity:${L.alpha}"></div>`; },
    vignette(L) { return `<div class="fill" style="background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(0,0,0,${L.alpha ?? 0.65}) 100%)"></div>`; },
    logo(L, r) {
      const t = L.t;
      const s = t < 5 ? 2.2 - 1.2 * (t / 5) : 1 + Math.max(0, 0.03 - (t - 5) * 0.004);
      const jx = t < 10 || r() < 0.1 ? (r() - 0.5) * 40 : 0;
      const a = L.fade && t > L.d - L.fade ? Math.max(0, (L.d - t) / L.fade) : 1;
      const sc = L.scale || 1;
      return `<div class="logo" style="top:${L.y ?? 50}%;transform:translate(calc(-50% + ${jx}px),-50%) scale(${s * sc});opacity:${a}"></div>`;
    },
    strip(L) {
      const a = Math.min(1, L.t / 8);
      return `<div class="strip" style="top:${L.y}%;opacity:${a};font-size:${L.size || 21}px;color:${L.color || '#8fdcff'};${L.weight ? 'font-family:Orbitron;font-weight:' + L.weight : ''}">${esc(L.text)}</div>`;
    },
    eye(L) {
      return `<img class="eye" src="assets/boss_eye_${L.look || 'neutral'}.png" style="width:${L.w || 420}px;transform:translate(-50%,-50%) scaleY(${L.sy ?? 1});opacity:${L.alpha ?? 1};filter:drop-shadow(0 0 40px rgba(255,40,60,.6))">`;
    },
    ring(L) { // target marker at canvas pixel coords
      const a = L.t < 5 ? L.t / 5 : 1, s = L.t < 5 ? 1.8 - 0.16 * L.t : 1 + 0.06 * Math.sin(L.t * 0.5);
      const c = L.color || '#ff4f6d';
      return `<div style="position:absolute;left:${L.x}px;top:${L.y}px;width:${L.r * 2}px;height:${L.r * 2}px;margin:-${L.r}px 0 0 -${L.r}px;border:3px solid ${c};border-radius:50%;opacity:${a};transform:scale(${s});box-shadow:0 0 18px ${c}"></div>` +
        (L.label ? `<div style="position:absolute;left:${L.x + L.r + 12}px;top:${L.y - 12}px;font:20px 'Share Tech Mono',monospace;letter-spacing:.18em;color:${c};opacity:${a};text-shadow:0 0 10px ${c};white-space:nowrap">${esc(L.label)}</div>` : '');
    },
    heat(L) { // large heat readout bound to the real game heat value
      const v = Math.round(L.v), segs = 20, on = Math.round((v / 100) * segs);
      const col = v >= 80 ? '#ff4f6d' : v >= 50 ? '#ffb347' : '#71efff';
      let bars = '';
      for (let k = 0; k < segs; k++) bars += `<span style="display:inline-block;width:14px;height:26px;margin-right:4px;background:${k < on ? col : 'rgba(255,255,255,.08)'};box-shadow:${k < on ? '0 0 10px ' + col : 'none'}"></span>`;
      return `<div style="position:absolute;left:40px;bottom:70px;font:22px 'Share Tech Mono',monospace;letter-spacing:.2em;color:${col};text-shadow:0 0 12px ${col}">HEAT ${String(v).padStart(3, ' ')}%<div style="margin-top:8px">${bars}</div></div>`;
    },
    scan(L) { // CRT scanlines + noise band
      return `<div class="fill" style="opacity:${L.alpha ?? 0.18};background:repeating-linear-gradient(0deg,rgba(0,0,0,.9) 0 2px,transparent 2px 4px)"></div>`;
    }
  };
  window.__ov = {
    render(layers, frame) {
      const root = ensure();
      const r = rngFor(frame + 1);
      root.innerHTML = layers.map((L) => (R[L.type] ? R[L.type](L, r) : '')).join('');
    },
    // Camera: transform the whole game layer (zoom/shake) and apply RGB split.
    cam({ scale = 1, ox = 50, oy = 50, x = 0, y = 0, rgb = 0, hide = false, bright = 1 } = {}) {
      const kids = [document.getElementById('__glitchcade_overlay')].filter(Boolean);
      for (const el of kids) {
        el.style.transformOrigin = `${ox}% ${oy}%`;
        el.style.transform = scale === 1 && !x && !y ? '' : `translate(${x}px,${y}px) scale(${scale})`;
        el.style.visibility = hide ? 'hidden' : '';
      }
      return;
      let svg = document.getElementById('__rgbsvg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = '__rgbsvg'; svg.setAttribute('width', 0); svg.setAttribute('height', 0); svg.style.position = 'absolute';
        svg.innerHTML = `<filter id="__rgbsplit" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/><feOffset in="r" id="__rgbdx1" dx="0" result="r2"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="gb"/><feOffset in="gb" id="__rgbdx2" dx="0" result="gb2"/><feBlend in="r2" in2="gb2" mode="screen"/></filter>`;
        document.body.appendChild(svg);
      }
      document.getElementById('__rgbdx1').setAttribute('dx', rgb);
      document.getElementById('__rgbdx2').setAttribute('dx', -rgb);
    }
  };
})();
