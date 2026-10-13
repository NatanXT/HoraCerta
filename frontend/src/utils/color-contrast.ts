export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface DerivedColorTokens {
  accent: string;
  accentHover: string;
  accentActive: string;
  accentForeground: '#FFFFFF' | '#0F172A';
  accentSoft: string;
  accentSoftForeground: string;
  accentBorder: string;
  focusRing: string;
}

/**
 * Normalizes HEX color string to #RRGGBB in uppercase.
 * Supports #RGB (expanding to #RRGGBB).
 */
export function normalizeHex(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let clean = raw.trim();
  if (!clean.startsWith('#')) {
    clean = '#' + clean;
  }

  // Check 3-digit hex #RGB -> #RRGGBB
  if (/^#[0-9A-Fa-f]{3}$/.test(clean)) {
    const r = clean[1];
    const g = clean[2];
    const b = clean[3];
    clean = `#${r}${r}${g}${g}${b}${b}`;
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(clean)) {
    return null;
  }

  return clean.toUpperCase();
}

/**
 * Checks whether the input string is a valid HEX color.
 */
export function isValidHex(raw: string): boolean {
  return normalizeHex(raw) !== null;
}

/**
 * Converts a valid HEX string to RGB components.
 */
export function hexToRgb(hexStr: string): RgbColor | null {
  const normalized = normalizeHex(hexStr);
  if (!normalized) return null;

  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);

  return { r, g, b };
}

/**
 * Converts RGB components (0-255) to normalized #RRGGBB.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculates relative luminance according to WCAG 2.1 specifications (0.0 to 1.0).
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const transform = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  const rs = transform(r);
  const gs = transform(g);
  const bs = transform(b);

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates contrast ratio between two relative luminance values according to WCAG 2.1 (1:1 to 21:1).
 */
export function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const DARK_TEXT_HEX = '#0F172A';
const LIGHT_TEXT_HEX = '#FFFFFF';
const DARK_TEXT_RGB = { r: 15, g: 23, b: 42 };
const DARK_TEXT_LUM = getRelativeLuminance(DARK_TEXT_RGB.r, DARK_TEXT_RGB.g, DARK_TEXT_RGB.b);
const LIGHT_TEXT_LUM = getRelativeLuminance(255, 255, 255);

/**
 * Returns either #FFFFFF or #0F172A to maximize contrast against the provided background HEX.
 * Guaranteed to satisfy WCAG AA contrast whenever possible.
 */
export function getForegroundForBackground(bgHex: string): '#FFFFFF' | '#0F172A' {
  const rgb = hexToRgb(bgHex) || { r: 79, g: 70, b: 229 };
  const bgLum = getRelativeLuminance(rgb.r, rgb.g, rgb.b);

  const whiteContrast = getContrastRatio(LIGHT_TEXT_LUM, bgLum);
  const darkContrast = getContrastRatio(DARK_TEXT_LUM, bgLum);

  return darkContrast > whiteContrast ? DARK_TEXT_HEX : LIGHT_TEXT_HEX;
}

/**
 * Derives accessible interactive tokens (hover, active, soft bg, foreground, focus ring)
 * for any 24-bit RGB color in both LIGHT and DARK modes.
 */
export function deriveColorTokens(accentHex: string, mode: 'LIGHT' | 'DARK'): DerivedColorTokens {
  const normalized = normalizeHex(accentHex) || '#4F46E5';
  const rgb = hexToRgb(normalized) || { r: 79, g: 70, b: 229 };
  const lum = getRelativeLuminance(rgb.r, rgb.g, rgb.b);

  const foreground = getForegroundForBackground(normalized);

  // Derive subtle hover/active by lightness shifting
  const adjustRgb = (factor: number) => {
    return rgbToHex(
      factor > 0 ? rgb.r + (255 - rgb.r) * factor : rgb.r * (1 + factor),
      factor > 0 ? rgb.g + (255 - rgb.g) * factor : rgb.g * (1 + factor),
      factor > 0 ? rgb.b + (255 - rgb.b) * factor : rgb.b * (1 + factor)
    );
  };

  let hover: string;
  let active: string;

  if (lum > 0.8) {
    // Very light colors (e.g. #FFFFFF, #FFFF00) -> darken slightly on hover/active
    hover = adjustRgb(-0.1);
    active = adjustRgb(-0.18);
  } else if (lum < 0.05) {
    // Very dark colors (e.g. #000000, #0F172A) -> lighten slightly on hover/active
    hover = adjustRgb(0.18);
    active = adjustRgb(0.28);
  } else {
    // Balanced colors
    hover = mode === 'LIGHT' ? adjustRgb(-0.08) : adjustRgb(0.12);
    active = mode === 'LIGHT' ? adjustRgb(-0.15) : adjustRgb(0.2);
  }

  // Soft container tokens
  const alpha = mode === 'LIGHT' ? 0.12 : 0.15;
  const borderAlpha = mode === 'LIGHT' ? 0.28 : 0.35;
  let soft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  let border = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${borderAlpha})`;
  let ring = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;

  if (mode === 'LIGHT') {
    if (lum > 0.8) {
      ring = 'rgba(15, 23, 42, 0.4)';
      border = 'rgba(15, 23, 42, 0.25)';
    }
  } else {
    if (lum < 0.05) {
      ring = 'rgba(248, 250, 252, 0.45)';
      border = 'rgba(248, 250, 252, 0.25)';
    }
  }

  // Soft text foreground must be readable on either light surface (#FFFFFF) or dark surface (#0F172A)
  let softForeground: string;
  if (mode === 'LIGHT') {
    // In Light mode, background is light (#FFFFFF / #F8FAFC)
    // If luminance > 0.18, contrast with white is < 4.5:1, so darken significantly for WCAG AA readability
    if (lum > 0.18) {
      softForeground = adjustRgb(-0.55);
    } else {
      softForeground = normalized;
    }
  } else {
    // In Dark mode, background is dark (#0F172A / #020617)
    // If luminance < 0.25, contrast with dark slate is < 4.5:1, so lighten significantly for WCAG AA readability
    if (lum < 0.25) {
      softForeground = adjustRgb(0.65);
    } else {
      softForeground = normalized;
    }
  }

  return {
    accent: normalized,
    accentHover: hover,
    accentActive: active,
    accentForeground: foreground,
    accentSoft: soft,
    accentSoftForeground: softForeground,
    accentBorder: border,
    focusRing: ring,
  };
}
