import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolução determinística do diretório dist a partir da localização deste arquivo
// __dirname: frontend/src/features/pwa -> ../../../dist: frontend/dist
const distDir = path.resolve(__dirname, '../../../dist');
const swPath = path.join(distDir, 'sw.js');
const manifestPath = path.join(distDir, 'manifest.webmanifest');

const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Lê e valida as dimensões de um buffer PNG a partir do chunk IHDR.
 */
export function getPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (!buffer.subarray(0, 8).equals(PNG_MAGIC_BYTES)) return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

/**
 * Função de validação rigorosa dos artefatos de build do PWA.
 * Lança ou relata falhas se qualquer artefato estiver ausente, corrompido ou fora dos padrões.
 */
export function validateDistPwaArtifacts(targetDir: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const targetSw = path.join(targetDir, 'sw.js');
  const targetManifest = path.join(targetDir, 'manifest.webmanifest');

  if (!fs.existsSync(targetSw)) {
    issues.push(`sw.js não encontrado em ${targetDir}`);
    return { valid: false, issues };
  }

  if (!fs.existsSync(targetManifest)) {
    issues.push(`manifest.webmanifest não encontrado em ${targetDir}`);
    return { valid: false, issues };
  }

  const swContent = fs.readFileSync(targetSw, 'utf-8');

  // Validação 1: Nenhum endpoint de API no precache
  const apiPatterns = [
    /\/api\/auth/,
    /\/api\/work-days/,
    /\/api\/work-sessions/,
    /\/api\/bank-hours/,
    /\/api\/profile/,
    /\/api\/reports/,
  ];
  for (const pattern of apiPatterns) {
    if (pattern.test(swContent)) {
      issues.push(`Endpoint sensível de API detectado no precache: ${pattern}`);
    }
  }

  // Validação 2: denylist explícita para /api/
  if (!/denylist:\[\/\^\\\/api\\\//.test(swContent)) {
    issues.push('Service Worker não possui denylist para rotas /api/');
  }

  // Validação 3: cleanupOutdatedCaches
  if (!swContent.includes('cleanupOutdatedCaches')) {
    issues.push('Service Worker não ativa cleanupOutdatedCaches');
  }

  // Validação 4: SKIP_WAITING sob comando
  if (!swContent.includes('SKIP_WAITING')) {
    issues.push('Service Worker não responde a evento SKIP_WAITING');
  }

  // Validação 5: Manifest válido e verificação rigorosa de ícones
  try {
    const rawManifest = fs.readFileSync(targetManifest, 'utf-8');
    const parsed = JSON.parse(rawManifest);

    if (parsed.display !== 'standalone') {
      issues.push(`Display mode deve ser standalone, recebido: ${parsed.display}`);
    }

    if (!Array.isArray(parsed.icons) || parsed.icons.length < 3) {
      issues.push('Manifest deve declarar pelo menos 3 ícones');
    }

    // Checagem física, assinatura binária e dimensões de cada ícone declarado
    for (const icon of parsed.icons || []) {
      const rel = (icon.src || '').replace(/^\//, '');
      const iconPath = path.join(targetDir, rel);
      if (!fs.existsSync(iconPath)) {
        issues.push(`Arquivo de ícone não existe no build: ${rel}`);
      } else {
        const buffer = fs.readFileSync(iconPath);
        if (buffer.length < 500) {
          issues.push(`Arquivo de ícone muito pequeno ou vazio: ${rel} (${buffer.length} bytes)`);
        }

        const dims = getPngDimensions(buffer);
        if (!dims) {
          issues.push(`Arquivo de ícone não possui cabeçalho PNG válido: ${rel}`);
        } else {
          // Se o nome do ícone contiver dimensões (ex: 192x192 ou 512x512)
          const sizeMatch = rel.match(/(\d+)x(\d+)/);
          if (sizeMatch) {
            const expectedW = parseInt(sizeMatch[1], 10);
            const expectedH = parseInt(sizeMatch[2], 10);
            if (dims.width !== expectedW || dims.height !== expectedH) {
              issues.push(
                `Dimensões incorretas para ${rel}: esperado ${expectedW}x${expectedH}, obtido ${dims.width}x${dims.height}`
              );
            }
          }
        }
      }
    }
  } catch (err: any) {
    issues.push(`Falha ao analisar manifest: ${err.message}`);
  }

  return { valid: issues.length === 0, issues };
}

describe('HoraCerta PWA — Política de Cache Segura e Integridade (Cenários 22 a 27 + Testes Negativos)', () => {
  it('22. precache do Service Worker contém estritamente recursos estáticos e ZERO endpoints de API', () => {
    expect(fs.existsSync(swPath), 'sw.js deve existir em frontend/dist. Execute o build antes dos testes.').toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');

    // Confirma que nenhum endpoint da API está presente na lista de precache
    expect(swContent).not.toMatch(/\/api\/auth/);
    expect(swContent).not.toMatch(/\/api\/work-days/);
    expect(swContent).not.toMatch(/\/api\/work-sessions/);
    expect(swContent).not.toMatch(/\/api\/bank-hours/);
    expect(swContent).not.toMatch(/\/api\/profile/);
    expect(swContent).not.toMatch(/\/api\/reports/);
  });

  it('23. Service Worker possui exclusão explícita de fallback para endpoints /api/', () => {
    expect(fs.existsSync(swPath), 'sw.js deve existir em frontend/dist').toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    // Verifica a configuração de denylist contendo /^\/api\//
    expect(swContent).toMatch(/denylist:\[\/\^\\\/api\\\//);
  });

  it('24. manifest.webmanifest é JSON válido e não expõe rotas privadas nem dados de usuário', () => {
    expect(fs.existsSync(manifestPath), 'manifest.webmanifest deve existir em frontend/dist').toBe(true);

    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw);

    expect(parsed.name).toBe('HoraCerta — Controle de Jornada');
    expect(parsed.short_name).toBe('HoraCerta');
    expect(parsed.display).toBe('standalone');
    expect(parsed.start_url).toBe('/');
    expect(parsed.scope).toBe('/');
    expect(Array.isArray(parsed.icons)).toBe(true);
    expect(parsed.icons.length).toBeGreaterThanOrEqual(3);

    // Não deve conter tokens, segredos ou rotas privadas
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toMatch(/bearer/i);
    expect(serialized).not.toMatch(/token/i);
    expect(serialized).not.toMatch(/api/i);
  });

  it('25. limpeza de caches obsoletos (cleanupOutdatedCaches) está ativada no Service Worker', () => {
    expect(fs.existsSync(swPath), 'sw.js deve existir em frontend/dist').toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toMatch(/cleanupOutdatedCaches/);
  });

  it('26. atualização via SKIP_WAITING é disparada exclusivamente mediante mensagem explícita', () => {
    expect(fs.existsSync(swPath), 'sw.js deve existir em frontend/dist').toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toMatch(/SKIP_WAITING/);
    expect(swContent).toMatch(/skipWaiting/);
  });

  it('27. ícones declarados no manifest existem fisicamente, possuem Magic Bytes PNG e dimensões exatas', () => {
    expect(fs.existsSync(manifestPath), 'manifest.webmanifest deve existir em frontend/dist').toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    for (const icon of manifest.icons) {
      const iconRelativePath = icon.src.replace(/^\//, '');
      const iconFullPath = path.join(distDir, iconRelativePath);
      expect(fs.existsSync(iconFullPath), `Ícone físico deve existir: ${iconFullPath}`).toBe(true);

      const buffer = fs.readFileSync(iconFullPath);
      expect(buffer.length).toBeGreaterThan(500); // Arquivo não vazio

      const dims = getPngDimensions(buffer);
      expect(dims, `Arquivo ${iconRelativePath} deve ser um PNG válido`).not.toBeNull();

      const sizeMatch = iconRelativePath.match(/(\d+)x(\d+)/);
      if (sizeMatch && dims) {
        expect(dims.width).toBe(parseInt(sizeMatch[1], 10));
        expect(dims.height).toBe(parseInt(sizeMatch[2], 10));
      }
    }
  });

  it('27b. teste negativo de validação: diretório vazio falha comprovadamente no validador', () => {
    const emptyTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-neg-empty-'));
    try {
      const result = validateDistPwaArtifacts(emptyTempDir);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((msg) => msg.includes('não encontrado'))).toBe(true);
    } finally {
      fs.rmSync(emptyTempDir, { recursive: true, force: true });
    }
  });

  it('27c. teste negativo de validação: ícone PNG corrompido ou com dimensões inválidas falha no validador', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-neg-corrupt-'));
    try {
      // Cria sw.js e manifest válidos na pasta temporária
      fs.writeFileSync(
        path.join(tempDir, 'sw.js'),
        'cleanupOutdatedCaches; denylist:[/^\\/api\\/]; SKIP_WAITING;'
      );

      const mockManifest = {
        name: 'HoraCerta — Controle de Jornada',
        short_name: 'HoraCerta',
        display: 'standalone',
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      };
      fs.writeFileSync(path.join(tempDir, 'manifest.webmanifest'), JSON.stringify(mockManifest));

      // Cria a pasta de ícones e grava um arquivo de texto fingindo ser PNG
      const iconsDir = path.join(tempDir, 'icons');
      fs.mkdirSync(iconsDir, { recursive: true });
      fs.writeFileSync(path.join(iconsDir, 'pwa-192x192.png'), 'corrupted-fake-image-bytes-not-a-png-file');
      fs.writeFileSync(path.join(iconsDir, 'pwa-512x512.png'), 'corrupted-fake-image-bytes-not-a-png-file');
      fs.writeFileSync(path.join(iconsDir, 'maskable-icon-512x512.png'), 'corrupted-fake-image-bytes-not-a-png-file');

      const result = validateDistPwaArtifacts(tempDir);
      expect(result.valid).toBe(false);
      expect(result.issues.some((msg) => msg.includes('não possui cabeçalho PNG válido'))).toBe(true);

      // Em contrapartida, a validação no diretório real distDir DEVE ser estritamente válida
      const realResult = validateDistPwaArtifacts(distDir);
      expect(realResult.valid).toBe(true);
      expect(realResult.issues).toEqual([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
