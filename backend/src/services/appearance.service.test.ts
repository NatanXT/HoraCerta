import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appearanceService, AppearanceService } from './appearance.service';
import { appearanceRepository } from '../repositories/appearance.repository';
import { DEFAULT_ACCENT_HEX, DEFAULT_FAVORITES, DEFAULT_THEME_MODE } from '../types/appearance.dto';
import { prisma } from '../lib/prisma';

describe('AppearanceService - ETAPA 11.4', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve retornar defaults para usuário sem preferências salvas', async () => {
    vi.spyOn(appearanceRepository, 'findByUserId').mockResolvedValue(null);

    const result = await appearanceService.getPreferences('user-1');

    expect(result.mode).toBe(DEFAULT_THEME_MODE);
    expect(result.accentHex).toBe(DEFAULT_ACCENT_HEX);
    expect(result.favorites).toEqual(DEFAULT_FAVORITES);
    expect(result.favorites).toHaveLength(9);
  });

  it('deve retornar preferências persistidas quando existentes', async () => {
    const customFavorites = DEFAULT_FAVORITES.map((f, i) =>
      i === 0 ? { id: '1', name: 'Azul Celeste', hex: '#38BDF8' } : f
    );

    vi.spyOn(appearanceRepository, 'findByUserId').mockResolvedValue({
      id: 'pref-1',
      userId: 'user-1',
      mode: 'LIGHT' as any,
      accentHex: '#38BDF8',
      favorites: customFavorites as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await appearanceService.getPreferences('user-1');

    expect(result.mode).toBe('LIGHT');
    expect(result.accentHex).toBe('#38BDF8');
    expect(result.favorites[0].name).toBe('Azul Celeste');
  });

  it('deve salvar e atualizar preferências com upsert para o usuário autenticado', async () => {
    const upsertSpy = vi.spyOn(appearanceRepository, 'upsert').mockResolvedValue({
      id: 'pref-1',
      userId: 'user-1',
      mode: 'LIGHT' as any,
      accentHex: '#059669',
      favorites: DEFAULT_FAVORITES as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await appearanceService.updatePreferences('user-1', {
      mode: 'LIGHT',
      accentHex: '#059669',
      favorites: DEFAULT_FAVORITES,
    });

    expect(upsertSpy).toHaveBeenCalledWith('user-1', {
      mode: 'LIGHT',
      accentHex: '#059669',
      favorites: expect.any(Array),
    });
    expect(result.mode).toBe('LIGHT');
    expect(result.accentHex).toBe('#059669');
  });

  it('deve garantir isolamento: Usuário A não acessa nem altera preferências de B', async () => {
    const memoryDb = new Map<string, any>();

    const customService = new AppearanceService({
      findByUserId: async (userId: string) => memoryDb.get(userId) || null,
      upsert: async (userId: string, data: any) => {
        const record = { id: `pref-${userId}`, userId, ...data };
        memoryDb.set(userId, record);
        return record;
      },
    } as any);

    // Usuário A salva LIGHT e Ciano
    await customService.updatePreferences('user-A', {
      mode: 'LIGHT',
      accentHex: '#0891B2',
      favorites: DEFAULT_FAVORITES,
    });

    // Usuário B salva DARK e Esmeralda
    await customService.updatePreferences('user-B', {
      mode: 'DARK',
      accentHex: '#059669',
      favorites: DEFAULT_FAVORITES,
    });

    const prefA = await customService.getPreferences('user-A');
    const prefB = await customService.getPreferences('user-B');

    expect(prefA.mode).toBe('LIGHT');
    expect(prefA.accentHex).toBe('#0891B2');

    expect(prefB.mode).toBe('DARK');
    expect(prefB.accentHex).toBe('#059669');
  });

  it('deve preservar os outros 8 favoritos ao editar um único slot', async () => {
    const updatedFavorites = [...DEFAULT_FAVORITES];
    updatedFavorites[3] = { id: '4', name: 'Verde Floresta', hex: '#166534' };

    vi.spyOn(appearanceRepository, 'upsert').mockImplementation(async (_uid, data) => ({
      id: 'pref-1',
      userId: 'user-1',
      mode: data.mode as any,
      accentHex: data.accentHex,
      favorites: data.favorites as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await appearanceService.updatePreferences('user-1', {
      mode: 'DARK',
      accentHex: '#4F46E5',
      favorites: updatedFavorites,
    });

    expect(result.favorites[3].name).toBe('Verde Floresta');
    expect(result.favorites[3].hex).toBe('#166534');
    // Os outros slots permanecem inalterados
    expect(result.favorites[0]).toEqual(DEFAULT_FAVORITES[0]);
    expect(result.favorites[1]).toEqual(DEFAULT_FAVORITES[1]);
    expect(result.favorites[2]).toEqual(DEFAULT_FAVORITES[2]);
    expect(result.favorites[4]).toEqual(DEFAULT_FAVORITES[4]);
  });

  it('alterar aparência não deve modificar WorkSchedule ou registros de ponto', async () => {
    const workScheduleFindSpy = vi.spyOn(prisma.workSchedule, 'findMany');
    const workDayFindSpy = vi.spyOn(prisma.workDay, 'findMany');

    vi.spyOn(appearanceRepository, 'upsert').mockResolvedValue({
      id: 'pref-1',
      userId: 'user-1',
      mode: 'LIGHT' as any,
      accentHex: '#EA580C',
      favorites: DEFAULT_FAVORITES as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await appearanceService.updatePreferences('user-1', {
      mode: 'LIGHT',
      accentHex: '#EA580C',
      favorites: DEFAULT_FAVORITES,
    });

    // Zero chamadas para tabelas de ponto ou jornada
    expect(workScheduleFindSpy).not.toHaveBeenCalled();
    expect(workDayFindSpy).not.toHaveBeenCalled();
  });

  it('GET de aparência é 100% read-only e não executa escrita no banco', async () => {
    const upsertSpy = vi.spyOn(appearanceRepository, 'upsert');
    vi.spyOn(appearanceRepository, 'findByUserId').mockResolvedValue(null);

    await appearanceService.getPreferences('user-1');

    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('deve garantir que seleções rápidas em sequência (Violeta -> Azul -> Esmeralda) persistem a última escolha (Esmeralda)', async () => {
    const memoryDb = new Map<string, any>();

    const customService = new AppearanceService({
      findByUserId: async (userId: string) => memoryDb.get(userId) || null,
      upsert: async (userId: string, data: any) => {
        const record = { id: `pref-${userId}`, userId, ...data };
        memoryDb.set(userId, record);
        return record;
      },
    } as any);

    // Seleção rápida 1: Violeta (#4F46E5)
    await customService.updatePreferences('user-rapid', {
      mode: 'DARK',
      accentHex: '#4F46E5',
      favorites: DEFAULT_FAVORITES,
    });

    // Seleção rápida 2: Azul (#0284C7)
    await customService.updatePreferences('user-rapid', {
      mode: 'DARK',
      accentHex: '#0284C7',
      favorites: DEFAULT_FAVORITES,
    });

    // Seleção rápida 3: Esmeralda (#10B981)
    await customService.updatePreferences('user-rapid', {
      mode: 'DARK',
      accentHex: '#10B981',
      favorites: DEFAULT_FAVORITES,
    });

    // Leitura subsequente (simula refresh F5)
    const persisted = await customService.getPreferences('user-rapid');

    expect(persisted.accentHex).toBe('#10B981');
    expect(persisted.mode).toBe('DARK');
  });

  it('deve garantir que atualização de favoritos não sobrescreve modo recente (Light/Dark)', async () => {
    const memoryDb = new Map<string, any>();

    const customService = new AppearanceService({
      findByUserId: async (userId: string) => memoryDb.get(userId) || null,
      upsert: async (userId: string, data: any) => {
        const record = { id: `pref-${userId}`, userId, ...data };
        memoryDb.set(userId, record);
        return record;
      },
    } as any);

    // 1. Usuário muda modo para LIGHT
    await customService.updatePreferences('user-mode', {
      mode: 'LIGHT',
      accentHex: '#10B981',
      favorites: DEFAULT_FAVORITES,
    });

    // 2. Imediatamente salva um favorito customizado
    const customFavorites = [...DEFAULT_FAVORITES];
    customFavorites[0] = { id: '1', name: 'Minha Cor', hex: '#FF00AA' };

    await customService.updatePreferences('user-mode', {
      mode: 'LIGHT',
      accentHex: '#FF00AA',
      favorites: customFavorites,
    });

    const persisted = await customService.getPreferences('user-mode');
    expect(persisted.mode).toBe('LIGHT');
    expect(persisted.accentHex).toBe('#FF00AA');
    expect(persisted.favorites[0].name).toBe('Minha Cor');
  });
});

