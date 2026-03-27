import confetti from "canvas-confetti";

const COLORS = [
  "#7c3aed",
  "#a78bfa",
  "#c4b5fd",
  "#fbbf24",
  "#f472b6",
  "#38bdf8",
] as const;

export function burstSeekConfetti(clientX: number, clientY: number) {
  if (typeof window === "undefined") return;

  const x = Math.min(1, Math.max(0, clientX / window.innerWidth));
  const y = Math.min(1, Math.max(0, clientY / window.innerHeight));

  const opts = {
    origin: { x, y },
    colors: [...COLORS],
    disableForReducedMotion: true,
  };

  void confetti({
    ...opts,
    particleCount: 52,
    spread: 62,
    startVelocity: 30,
    gravity: 1.02,
    scalar: 0.95,
    ticks: 95,
  });

  window.setTimeout(() => {
    void confetti({
      ...opts,
      particleCount: 28,
      spread: 95,
      startVelocity: 20,
      gravity: 1.15,
      scalar: 0.72,
      ticks: 75,
    });
  }, 110);
}
