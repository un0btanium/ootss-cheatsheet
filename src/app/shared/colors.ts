/** Color helpers for category labels (WCAG contrast, random readable pairs). */

export const MIN_CONTRAST = 4.5;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#rrggbb` colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Converts HSL (h: 0–360, s/l: 0–100) to `#rrggbb`. */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return (
    '#' +
    [f(0), f(8), f(4)]
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Contrast the randomizer aims for (WCAG AAA); MIN_CONTRAST is the hard floor. */
const TARGET_CONTRAST = 7;

/** Returns a random [text, background] pair, aiming for strong contrast (never below MIN_CONTRAST). */
export function randomColorPair(): [string, string] {
  const bg = hslToHex(rand(0, 360), rand(35, 90), rand(15, 85));
  let best: [string, number] | undefined;
  for (let i = 0; i < 100; i++) {
    const text = hslToHex(rand(0, 360), rand(0, 100), rand(0, 100));
    const ratio = contrastRatio(text, bg);
    if (ratio >= TARGET_CONTRAST) return [text, bg];
    if (ratio >= MIN_CONTRAST && (!best || ratio > best[1])) best = [text, ratio];
  }
  if (best) return [best[0], bg];
  const black = '#000000';
  const white = '#ffffff';
  return [contrastRatio(black, bg) >= contrastRatio(white, bg) ? black : white, bg];
}
