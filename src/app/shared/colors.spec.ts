import { contrastRatio, hslToHex, MIN_CONTRAST, randomColorPair } from './colors';

describe('colors', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('converts HSL to hex', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    expect(hslToHex(120, 100, 25)).toBe('#008000');
    expect(hslToHex(0, 0, 100)).toBe('#ffffff');
  });

  it('generates readable random pairs', () => {
    for (let i = 0; i < 200; i++) {
      const [text, bg] = randomColorPair();
      expect(text).toMatch(/^#[0-9a-f]{6}$/);
      expect(bg).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
});
