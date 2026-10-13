import { describe, it, expect } from 'vitest';
import { updateAppearanceSchema } from './appearance.schema';
import { DEFAULT_FAVORITES } from '../types/appearance.dto';

describe('Appearance Schema Validation - ETAPA 11.4', () => {
  it('deve aceitar payload válido com modo LIGHT, hex normalizado e 9 favoritos', () => {
    const validPayload = {
      mode: 'LIGHT',
      accentHex: '#059669',
      favorites: DEFAULT_FAVORITES,
    };

    const parsed = updateAppearanceSchema.parse(validPayload);
    expect(parsed.mode).toBe('LIGHT');
    expect(parsed.accentHex).toBe('#059669');
    expect(parsed.favorites).toHaveLength(9);
  });

  it('deve normalizar hex em minúsculas para maiúsculas', () => {
    const payload = {
      mode: 'DARK',
      accentHex: '#ea580c',
      favorites: DEFAULT_FAVORITES,
    };

    const parsed = updateAppearanceSchema.parse(payload);
    expect(parsed.accentHex).toBe('#EA580C');
  });

  it('deve rejeitar modo inválido', () => {
    const payload = {
      mode: 'SYSTEM',
      accentHex: '#059669',
      favorites: DEFAULT_FAVORITES,
    };

    expect(() => updateAppearanceSchema.parse(payload)).toThrow();
  });

  it('deve rejeitar HEX inválido ou com injeção CSS arbitrária', () => {
    const payload = {
      mode: 'DARK',
      accentHex: 'red; background: blue;',
      favorites: DEFAULT_FAVORITES,
    };

    expect(() => updateAppearanceSchema.parse(payload)).toThrow();
  });

  it('deve rejeitar se a lista de favoritos não contiver exatamente 9 slots', () => {
    const payloadWith8 = {
      mode: 'DARK',
      accentHex: '#4F46E5',
      favorites: DEFAULT_FAVORITES.slice(0, 8),
    };

    expect(() => updateAppearanceSchema.parse(payloadWith8)).toThrow(
      'A paleta de favoritos deve conter exatamente 9 cores'
    );

    const payloadWith10 = {
      mode: 'DARK',
      accentHex: '#4F46E5',
      favorites: [...DEFAULT_FAVORITES, { id: '10', name: 'Extra', hex: '#123456' }],
    };

    expect(() => updateAppearanceSchema.parse(payloadWith10)).toThrow(
      'A paleta de favoritos deve conter exatamente 9 cores'
    );
  });

  it('deve rejeitar favorito com nome vazio', () => {
    const invalidFavorites = [...DEFAULT_FAVORITES];
    invalidFavorites[0] = { id: '1', name: '   ', hex: '#2563EB' };

    const payload = {
      mode: 'DARK',
      accentHex: '#4F46E5',
      favorites: invalidFavorites,
    };

    expect(() => updateAppearanceSchema.parse(payload)).toThrow('O nome da cor é obrigatório');
  });
});
