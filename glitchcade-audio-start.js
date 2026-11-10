// Load independently of Three.js so the title menu's first press owns playback.
import { createArcadeAudio } from './glitchcade-audio.js?v=glitchcade-8';

export const arcadeAudio = createArcadeAudio({
  isTouch: window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
});

let scene = () => ({ world: null, location: null });
export function setAudioScene(getScene) { scene = getScene; }

function unlockAudio() {
  const current = scene();
  if (current) arcadeAudio.unlock(current.world, current.location);
}

window.addEventListener('pointerdown', unlockAudio, true);
window.addEventListener('keydown', unlockAudio, true);
// Touch browsers may grant audio activation only when the finger is released.
// Retry within that gesture rather than requiring another tap.
window.addEventListener('touchend', unlockAudio, { capture: true, passive: true });
