import { describe, it, expect } from 'vitest';
import {
  normalizeHex,
  isValidHex,
  hexToRgb,
  rgbToHex,
  getRelativeLuminance,
  getContrastRatio,
  getForegroundForBackground,
  deriveColorTokens,
} from './color-contrast';

describe('Color & Contrast Utilities - ETAPA 11.4', () => {
  describe('HEX normalization & conversion', () => {
    it('deve normalizar corretamente HEX de 6 dígitos para maiúsculas com #', () => {
      expect(normalizeHex('#4f46e5')).toBe('#4F46E5');
      expect(normalizeHex('4f46e5')).toBe('#4F46E5');
      expect(normalizeHex('  #2563eb  ')).toBe('#2563EB');
    });

    it('deve expandir e normalizar formato curto de 3 dígitos (#RGB)', () => {
      expect(normalizeHex('#FFF')).toBe('#FFFFFF');
      expect(normalizeHex('000')).toBe('#000000');
      expect(normalizeHex('#f0a')).toBe('#FF00AA');
    });

    it('deve rejeitar valores inválidos retornando null e false em isValidHex', () => {
      expect(normalizeHex('not-a-color')).toBeNull();
      expect(normalizeHex('#GGGGGG')).toBeNull();
      expect(normalizeHex('#12345')).toBeNull();
      expect(normalizeHex('#1234567')).toBeNull();
      expect(normalizeHex('')).toBeNull();
      expect(isValidHex('inválido')).toBe(false);
      expect(isValidHex('#16A34A')).toBe(true);
    });

    it('deve converter HEX para RGB com precisão', () => {
      expect(hexToRgb('#16A34A')).toEqual({ r: 22, g: 163, b: 74 });
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('invalid')).toBeNull();
    });

    it('deve converter RGB para HEX clampando valores fora do intervalo 0-255', () => {
      expect(rgbToHex(22, 163, 74)).toBe('#16A34A');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
      expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF');
      expect(rgbToHex(-10, 300, 128)).toBe('#00FF80');
    });
  });

  describe('Luminance and Contrast calculation', () => {
    it('deve calcular luminância relativa conforme especificação WCAG', () => {
      expect(getRelativeLuminance(0, 0, 0)).toBe(0);
      expect(getRelativeLuminance(255, 255, 255)).toBe(1);
      // Yellow should have very high luminance
      const yellowLum = getRelativeLuminance(255, 255, 0);
      expect(yellowLum).toBeGreaterThan(0.9);
      // Dark slate #0F172A should have very low luminance
      const darkSlateLum = getRelativeLuminance(15, 23, 42);
      expect(darkSlateLum).toBeLessThan(0.02);
    });

    it('deve calcular razão de contraste (1:1 até 21:1)', () => {
      expect(getContrastRatio(0, 1)).toBe(21);
      expect(getContrastRatio(0.5, 0.5)).toBe(1);
    });
  });

  describe('Foreground contrast selection for extreme and saturated colors', () => {
    it('deve escolher Dark (#0F172A) para cores claras (#FFFFFF, #FFFF00, #00FF00) garantindo contraste WCAG AA', () => {
      expect(getForegroundForBackground('#FFFFFF')).toBe('#0F172A');
      expect(getForegroundForBackground('#FFFF00')).toBe('#0F172A'); // Amarelo puro
      expect(getForegroundForBackground('#00FF00')).toBe('#0F172A'); // Verde claro puro
    });

    it('deve escolher Branco (#FFFFFF) para cores escuras (#000000, #0F172A, #4F46E5) garantindo contraste WCAG AA', () => {
      expect(getForegroundForBackground('#000000')).toBe('#FFFFFF');
      expect(getForegroundForBackground('#0F172A')).toBe('#FFFFFF'); // Meia-noite
      expect(getForegroundForBackground('#4F46E5')).toBe('#FFFFFF'); // Violeta padrão
    });

    it('deve escolher a melhor legibilidade para cores saturadas (#FF00FF magenta, #FF6500 laranja, #2563EB azul)', () => {
      expect(getForegroundForBackground('#FF00FF')).toBe('#0F172A'); // Contraste 5.4:1 (Dark) vs 3.1:1 (White)
      expect(getForegroundForBackground('#FF6500')).toBe('#0F172A');
      expect(getForegroundForBackground('#2563EB')).toBe('#FFFFFF');
    });
  });

  describe('Token derivation for LIGHT and DARK themes', () => {
    it('deve derivar tokens acessíveis e consistentes no modo LIGHT', () => {
      const tokens = deriveColorTokens('#4F46E5', 'LIGHT');
      expect(tokens.accent).toBe('#4F46E5');
      expect(tokens.accentForeground).toBe('#FFFFFF');
      expect(tokens.accentSoft).toContain('rgba(79, 70, 229,');
      expect(tokens.focusRing).toContain('rgba(79, 70, 229,');
      expect(tokens.accentHover).toBeTruthy();
      expect(tokens.accentActive).toBeTruthy();
    });

    it('deve derivar tokens acessíveis e consistentes no modo DARK', () => {
      const tokens = deriveColorTokens('#4F46E5', 'DARK');
      expect(tokens.accent).toBe('#4F46E5');
      expect(tokens.accentForeground).toBe('#FFFFFF');
      expect(tokens.accentSoft).toContain('rgba(79, 70, 229,');
    });

    it('deve tratar cores extremas (como amarelo puro no modo LIGHT) escurecendo soft text para leitura', () => {
      const yellowTokens = deriveColorTokens('#FFFF00', 'LIGHT');
      expect(yellowTokens.accentForeground).toBe('#0F172A');
      // soft foreground shouldn't be unreadable yellow on light bg
      expect(yellowTokens.accentSoftForeground).not.toBe('#FFFF00');
    });

    it('deve tratar cores extremas (como preto no modo DARK) clareando soft text para leitura', () => {
      const blackTokens = deriveColorTokens('#000000', 'DARK');
      expect(blackTokens.accentForeground).toBe('#FFFFFF');
      // soft foreground shouldn't be unreadable black on dark bg
      expect(blackTokens.accentSoftForeground).not.toBe('#000000');
    });

    it('deve validar contraste dos 7 extremos requeridos: Branco, Preto, Amarelo, Verde-limão, Rosa/Magenta, Meia-noite e Violeta', () => {
      const colors = [
        { hex: '#FFFFFF', name: 'Branco puro' },
        { hex: '#000000', name: 'Preto puro' },
        { hex: '#FFFF00', name: 'Amarelo puro' },
        { hex: '#00FF00', name: 'Verde-limão' },
        { hex: '#FF00FF', name: 'Rosa/magenta' },
        { hex: '#0F172A', name: 'Meia-noite' },
        { hex: '#4F46E5', name: 'Violeta padrão' },
      ];

      for (const { hex } of colors) {
        const lightTokens = deriveColorTokens(hex, 'LIGHT');
        const darkTokens = deriveColorTokens(hex, 'DARK');

        // Primary foreground must be either #FFFFFF or #0F172A
        expect(['#FFFFFF', '#0F172A']).toContain(lightTokens.accentForeground);
        expect(['#FFFFFF', '#0F172A']).toContain(darkTokens.accentForeground);

        // Focus rings and borders must never be empty
        expect(lightTokens.focusRing).toBeTruthy();
        expect(darkTokens.focusRing).toBeTruthy();
        expect(lightTokens.accentBorder).toBeTruthy();
        expect(darkTokens.accentBorder).toBeTruthy();

        // For pure white in light mode, focus ring and border must have dark outline
        if (hex === '#FFFFFF') {
          expect(lightTokens.focusRing).toContain('rgba(15, 23, 42,');
          expect(lightTokens.accentBorder).toContain('rgba(15, 23, 42,');
        }

        // For pure black in dark mode, focus ring and border must have light outline
        if (hex === '#000000') {
          expect(darkTokens.focusRing).toContain('rgba(248, 250, 252,');
          expect(darkTokens.accentBorder).toContain('rgba(248, 250, 252,');
        }
      }
    });
  });
});

