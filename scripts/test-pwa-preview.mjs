import { spawn } from 'child_process';
import http from 'http';
import net from 'net';

const PREVIEW_PORT = 4173;
const BASE_URL = `http://localhost:${PREVIEW_PORT}`;

// 8 bytes do cabeçalho de assinatura binária PNG: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

function fetchUrlBuffer(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          buffer,
          text: buffer.toString('utf-8'),
        });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout de ${timeoutMs}ms excedido para ${url}`));
    });

    req.on('error', reject);
  });
}

function parsePngDimensions(buffer) {
  // O IHDR em arquivos PNG padrão começa após os 8 bytes de assinatura (offset 8 a 11 tamanho, 12 a 15 'IHDR')
  // Largura: bytes 16..19 (uint32 big-endian)
  // Altura: bytes 20..23 (uint32 big-endian)
  if (buffer.length < 24) return null;
  const isPng = buffer.subarray(0, 8).equals(PNG_MAGIC_BYTES);
  if (!isPng) return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

async function waitForServerReady(url, maxTimeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxTimeoutMs) {
    try {
      const res = await fetchUrlBuffer(url, 1000);
      if (res.statusCode === 200) {
        return true;
      }
    } catch {
      // Servidor ainda iniciando
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function run() {
  console.log(`[PWA PREVIEW CHECK] Verificando disponibilidade da porta ${PREVIEW_PORT}...`);
  const isPortFree = await checkPortAvailable(PREVIEW_PORT);
  if (!isPortFree) {
    console.error(`ERRO: A porta ${PREVIEW_PORT} já está em uso! Encerre instâncias anteriores antes de executar.`);
    process.exitCode = 1;
    return;
  }

  console.log(`[PWA PREVIEW CHECK] Iniciando Vite preview server na porta ${PREVIEW_PORT}...`);
  const isWin = process.platform === 'win32';
  const proc = spawn(isWin ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    cwd: 'frontend',
    stdio: 'ignore',
    shell: true,
  });

  const spawnedPid = proc.pid;
  let allOk = true;

  try {
    const ready = await waitForServerReady(`${BASE_URL}/`, 15000);
    if (!ready) {
      throw new Error(`Servidor Vite preview não respondeu dentro do limite de tempo na porta ${PREVIEW_PORT}`);
    }
    console.log(`[PWA PREVIEW CHECK] Servidor Vite preview ativo e respondendo na porta ${PREVIEW_PORT}.\n`);

    // 1. Verificação do Web App Manifest (Status, MIME e Estrutura)
    console.log('--- 1. Web App Manifest ---');
    const manifestRes = await fetchUrlBuffer(`${BASE_URL}/manifest.webmanifest`);
    const manifestContentType = (manifestRes.headers['content-type'] || '').toLowerCase();
    const isManifestMimeValid =
      manifestContentType.includes('application/manifest+json') ||
      manifestContentType.includes('application/json');

    let isManifestJsonValid = false;
    try {
      const data = JSON.parse(manifestRes.text);
      isManifestJsonValid =
        data.name === 'HoraCerta — Controle de Jornada' &&
        data.short_name === 'HoraCerta' &&
        data.display === 'standalone' &&
        data.start_url === '/' &&
        data.scope === '/' &&
        Array.isArray(data.icons) &&
        data.icons.length >= 3;
    } catch {
      isManifestJsonValid = false;
    }

    const isManifestOk = manifestRes.statusCode === 200 && isManifestMimeValid && isManifestJsonValid;
    console.log(`- Status HTTP: ${manifestRes.statusCode} (${manifestRes.statusCode === 200 ? 'OK' : 'FAIL'})`);
    console.log(`- MIME type: ${manifestContentType} (${isManifestMimeValid ? 'OK' : 'FAIL'})`);
    console.log(`- Estrutura JSON e standalone: ${isManifestJsonValid ? 'OK' : 'FAIL'}`);
    if (!isManifestOk) allOk = false;

    // 2. Verificação do Service Worker (sw.js)
    console.log('\n--- 2. Service Worker (sw.js) ---');
    const swRes = await fetchUrlBuffer(`${BASE_URL}/sw.js`);
    const swContentType = (swRes.headers['content-type'] || '').toLowerCase();
    const isSwMimeValid =
      swContentType.includes('javascript') || swContentType.includes('text/javascript');
    const swHasDenylist =
      swRes.text.includes('/^\\/api\\//') || /denylist:\[\/\^\\\/api\\\//.test(swRes.text);
    const swHasCleanup = swRes.text.includes('cleanupOutdatedCaches');
    const swHasSkipWaiting = swRes.text.includes('SKIP_WAITING');

    const isSwOk =
      swRes.statusCode === 200 && isSwMimeValid && swHasDenylist && swHasCleanup && swHasSkipWaiting;
    console.log(`- Status HTTP: ${swRes.statusCode} (${swRes.statusCode === 200 ? 'OK' : 'FAIL'})`);
    console.log(`- MIME type: ${swContentType} (${isSwMimeValid ? 'OK' : 'FAIL'})`);
    console.log(`- Denylist para /api/: ${swHasDenylist ? 'OK' : 'FAIL'}`);
    console.log(`- cleanupOutdatedCaches: ${swHasCleanup ? 'OK' : 'FAIL'}`);
    console.log(`- SKIP_WAITING ativo: ${swHasSkipWaiting ? 'OK' : 'FAIL'}`);
    if (!isSwOk) allOk = false;

    // 3. Verificação de Integridade e Dimensões dos Ícones PNG
    console.log('\n--- 3. Ícones PWA (Magic Bytes e Dimensões Reais) ---');
    const expectedIcons = [
      { path: '/icons/pwa-192x192.png', expectedW: 192, expectedH: 192 },
      { path: '/icons/pwa-512x512.png', expectedW: 512, expectedH: 512 },
      { path: '/icons/maskable-icon-512x512.png', expectedW: 512, expectedH: 512 },
      { path: '/icons/apple-touch-icon-180x180.png', expectedW: 180, expectedH: 180 },
    ];

    for (const icon of expectedIcons) {
      const iconRes = await fetchUrlBuffer(`${BASE_URL}${icon.path}`);
      const isStatusOk = iconRes.statusCode === 200;
      const isMimePng = (iconRes.headers['content-type'] || '').toLowerCase().includes('image/png');
      const dimensions = parsePngDimensions(iconRes.buffer);
      const isDimensionMatch =
        dimensions !== null &&
        dimensions.width === icon.expectedW &&
        dimensions.height === icon.expectedH;

      const isIconOk = isStatusOk && isMimePng && isDimensionMatch;
      console.log(
        `- ${icon.path}: Status ${iconRes.statusCode}, MIME ${iconRes.headers['content-type']}, Dimensões ${dimensions ? `${dimensions.width}x${dimensions.height}` : 'Inválidas'} (${isIconOk ? 'OK' : 'FAIL'})`
      );
      if (!isIconOk) allOk = false;
    }

    // 4. Verificação de Rotas SPA (HTML Shell com status 200)
    console.log('\n--- 4. Navegação SPA (HTML Shell) ---');
    const spaRoutes = ['/', '/login', '/perfil'];
    for (const route of spaRoutes) {
      const pageRes = await fetchUrlBuffer(`${BASE_URL}${route}`);
      const is200 = pageRes.statusCode === 200;
      const isHtml = (pageRes.headers['content-type'] || '').toLowerCase().includes('text/html');
      console.log(`- Rota ${route}: Status ${pageRes.statusCode}, Content-Type: ${pageRes.headers['content-type']} (${is200 && isHtml ? 'OK' : 'FAIL'})`);
      if (!is200 || !isHtml) allOk = false;
    }

    // 5. Verificação da Defesa contra Falso Positivo 200 (SPA Fallback)
    console.log('\n--- 5. Defesa contra Falso Positivo 200 (SPA Fallback) ---');
    const apiHealthRes = await fetchUrlBuffer(`${BASE_URL}/api/health`);
    const isSpaHtml = (apiHealthRes.headers['content-type'] || '').toLowerCase().includes('text/html');
    console.log(`- Consulta relativa ${BASE_URL}/api/health retornou Content-Type: ${apiHealthRes.headers['content-type']}`);
    console.log(`- Retornou HTML em vez de JSON: ${isSpaHtml ? 'SIM (comprova comportamento de fallback)' : 'NÃO'}`);
    if (!isSpaHtml) {
      console.warn('AVISO: O servidor de preview retornou resposta diferente de HTML para rota inexistente de API.');
    }

    if (allOk) {
      console.log('\n===============================================================');
      console.log('Validação dos artefatos e endpoints do preview concluída.');
      console.log('===============================================================');
    } else {
      console.error('\n===============================================================');
      console.error('ERRO: Falha em uma ou mais verificações obrigatórias do preview!');
      console.error('===============================================================');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Erro durante execução do script de preview:', err);
    process.exitCode = 1;
  } finally {
    console.log('\nFinalizando processo do Vite preview server...');
    if (spawnedPid) {
      if (isWin) {
        try {
          spawn('taskkill', ['/pid', String(spawnedPid), '/T', '/F'], { stdio: 'ignore' });
        } catch {}
      } else {
        try {
          proc.kill('SIGTERM');
        } catch {}
      }
    }
  }
}

run();
