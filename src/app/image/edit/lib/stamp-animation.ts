// ──────────────────────────────────────────────
// Easing functions
// ──────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

// ──────────────────────────────────────────────
// Stamp animation frames
// ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function animateCircleStamp(group: any, progress: number, finalAngle: number, x: number, y: number): void {
  if (progress < 0.55) {
    const p = progress / 0.55;
    const eased = easeOutCubic(p);
    group.set({
      scaleX: 2.5 - 1.5 * eased,
      scaleY: 2.5 - 1.5 * eased,
      opacity: 0.3 + 0.7 * eased,
      angle: finalAngle + 10 * (1 - eased),
      top: y,
      left: x,
    });
  } else if (progress < 0.75) {
    const p = (progress - 0.55) / 0.2;
    const squash = Math.sin(p * Math.PI) * 0.6;
    group.set({
      scaleX: 1 + 0.08 * squash,
      scaleY: 1 - 0.06 * squash,
      opacity: 1,
      angle: finalAngle - 2 * squash,
      top: y + 3 * squash,
    });
  } else {
    const p = (progress - 0.75) / 0.25;
    const elastic = easeOutElastic(p);
    group.set({
      scaleX: 1 + 0.03 * (1 - elastic),
      scaleY: 1 - 0.02 * (1 - elastic),
      angle: finalAngle,
      top: y + 1 * (1 - elastic),
      opacity: 1,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function animateRectStamp(group: any, progress: number, finalAngle: number, x: number, y: number): void {
  if (progress < 0.6) {
    const p = progress / 0.6;
    const eased = easeOutBack(p);
    group.set({
      scaleX: 2 - 1 * eased,
      scaleY: 2 - 1 * eased,
      opacity: 0.4 + 0.6 * p,
      angle: finalAngle + 8 * (1 - p),
      top: y,
      left: x,
    });
  } else if (progress < 0.8) {
    const p = (progress - 0.6) / 0.2;
    const squash = Math.sin(p * Math.PI) * 0.5;
    group.set({
      scaleX: 1 + 0.05 * squash,
      scaleY: 1 - 0.03 * squash,
      opacity: 1,
      angle: finalAngle,
      top: y + 2 * squash,
    });
  } else {
    const p = (progress - 0.8) / 0.2;
    const settle = 1 - (1 - p) ** 3;
    group.set({
      scaleX: 1 + 0.05 * (1 - settle),
      scaleY: 1 - 0.03 * (1 - settle),
      angle: finalAngle,
      top: y + 2 * (1 - settle),
      opacity: 1,
    });
  }
}

// ──────────────────────────────────────────────
// Ink spread DOM effect for circle stamps
// ──────────────────────────────────────────────

export function createInkSpreadEffect(
  wrapper: HTMLElement,
  x: number,
  y: number,
  stampRadius: number,
  color: string,
  angle: number,
): void {
  const size = stampRadius * 2 + 10;

  function createRing(offset: number): HTMLDivElement {
    const ring = document.createElement("div");
    ring.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${size - offset}px;
      height: ${size - offset}px;
      transform: translate(-50%, -50%) scale(0.9) rotate(${angle}deg);
      border: ${offset === 0 ? 2 : 1}px solid ${color};
      border-radius: 50%;
      opacity: 0;
      pointer-events: none;
      z-index: 100;
    `;
    return ring;
  }

  const outerRing = createRing(0);
  const innerRing = createRing(14);
  wrapper.appendChild(outerRing);
  wrapper.appendChild(innerRing);

  setTimeout(() => {
    const expandTransition = "all 0.25s cubic-bezier(0.22, 1, 0.36, 1)";
    outerRing.style.transition = expandTransition;
    outerRing.style.transform = `translate(-50%, -50%) scale(1.05) rotate(${angle}deg)`;
    outerRing.style.opacity = "0.5";

    innerRing.style.transition = expandTransition;
    innerRing.style.transform = `translate(-50%, -50%) scale(1.05) rotate(${angle}deg)`;
    innerRing.style.opacity = "0.3";

    setTimeout(() => {
      const fadeTransition = "all 0.2s ease-out";
      outerRing.style.transition = fadeTransition;
      outerRing.style.transform = `translate(-50%, -50%) scale(1.15) rotate(${angle}deg)`;
      outerRing.style.opacity = "0";

      innerRing.style.transition = fadeTransition;
      innerRing.style.transform = `translate(-50%, -50%) scale(1.1) rotate(${angle}deg)`;
      innerRing.style.opacity = "0";

      setTimeout(() => {
        outerRing.remove();
        innerRing.remove();
      }, 200);
    }, 120);
  }, 220);
}
