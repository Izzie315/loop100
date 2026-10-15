// Synthesized ringtone (incoming) and ringback (outgoing) using Web Audio.
let ctx: AudioContext | null = null;
let timer: number | null = null;

function audio() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C();
  }
  void ctx.resume().catch(() => undefined);
  return ctx;
}

/** Unlock audio on first tap so iOS lets the ringtone play later. */
export function primeAudio() {
  if (typeof window === "undefined") return;
  const unlock = () => {
    try { audio(); } catch { /* ignore */ }
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function tone(freqs: number[], start: number, dur: number, vol: number) {
  const a = audio();
  const g = a.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.02);
  g.gain.setValueAtTime(vol, start + dur - 0.03);
  g.gain.linearRampToValueAtTime(0, start + dur);
  g.connect(a.destination);
  for (const f of freqs) {
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(g);
    o.start(start);
    o.stop(start + dur);
  }
}

export function startRinging(mode: "incoming" | "outgoing") {
  stopRinging();
  try {
    const play = () => {
      const t = audio().currentTime + 0.05;
      if (mode === "incoming") {
        // classic double ring: brr-brr
        tone([440, 480], t, 0.4, 0.25);
        tone([440, 480], t + 0.6, 0.4, 0.25);
        navigator.vibrate?.([400, 200, 400]);
      } else {
        tone([440, 480], t, 1.2, 0.08);
      }
    };
    play();
    timer = window.setInterval(play, mode === "incoming" ? 3000 : 4000);
  } catch { /* audio unavailable */ }
}

export function stopRinging() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  navigator.vibrate?.(0);
}
