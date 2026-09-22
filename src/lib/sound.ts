/** Son de confirmation discret (clic léger), activable depuis « Modifications ». */
let enabled = true;

export function setSoundEnabled(value: boolean) {
  enabled = value;
  if (typeof window !== "undefined") localStorage.setItem("cct-sound", value ? "on" : "off");
}

export function loadSoundPreference(value: string | undefined) {
  const stored = typeof window !== "undefined" ? localStorage.getItem("cct-sound") : null;
  enabled = (stored ?? value ?? "on") === "on";
}

export function playConfirm() {
  if (!enabled || typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
    osc.onended = () => void ctx.close();
  } catch {
    /* le son reste facultatif */
  }
}
