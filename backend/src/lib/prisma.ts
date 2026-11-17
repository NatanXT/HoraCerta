import { PrismaClient } from '@prisma/client';

const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

export interface DatabaseValidationResult {
  valid: boolean;
  reason?: string;
}

function normalizeHost(host: string): string {
  const cleaned = host.toLowerCase().trim().replace(/^\[/, '').replace(/\]$/, '');
  if (cleaned === '127.0.0.1' || cleaned === '::1' || cleaned === 'localhost' || cleaned === '') {
    return 'localhost';
  }
  return cleaned;
}

export function validateTestDatabaseUrl(
  testUrl?: string,
  mainUrl?: string
): DatabaseValidationResult {
  if (!testUrl || testUrl.trim() === '') {
    return { valid: false, reason: 'TEST_DATABASE_URL não foi informada ou está vazia' };
  }

  const trimmedTest = testUrl.trim();

  // 1. Validar protocolo (somente postgresql:// ou postgres://)
  if (!/^postgres(?:ql)?:\/\//i.test(trimmedTest)) {
    return {
      valid: false,
      reason: 'Protocolo inválido em TEST_DATABASE_URL. Deve iniciar com postgresql:// ou postgres://',
    };
  }

  // 2. Parse da URL
  let parsedTest: URL;
  try {
    const sanitizedForParse = trimmedTest.replace(/^postgres(?:ql)?:\/\//i, 'http://');
    parsedTest = new URL(sanitizedForParse);
  } catch {
    return { valid: false, reason: 'TEST_DATABASE_URL possui formato inválido ou malformado' };
  }

  const testHost = normalizeHost(parsedTest.hostname);
  const testPort = parsedTest.port || '5432';
  const rawPath = parsedTest.pathname.replace(/^\//, '');
  const testDbName = rawPath.split('?')[0].toLowerCase().trim();

  if (!testDbName) {
    return { valid: false, reason: 'TEST_DATABASE_URL não especifica o nome da base de dados' };
  }

  // 3. Bases reservadas ou associadas a dados reais/produção
  const forbiddenDbNames = [
    'horacerta',
    'horacerta_prod',
    'horacerta_production',
    'postgres',
    'template0',
    'template1',
  ];
  if (forbiddenDbNames.includes(testDbName)) {
    return {
      valid: false,
      reason: `O banco '${testDbName}' aponta para base pessoal/produção ou reservada`,
    };
  }

  // 4. Bloqueio absoluto: Rejeitar qualquer banco de teste na MESMA instância (host/porta) do PostgreSQL pessoal
  // Determinar parâmetros da instância principal conhecida (padrão: localhost:5432 / horacerta)
  let mainHost = 'localhost';
  let mainPort = '5432';

  if (mainUrl && mainUrl.trim() !== '') {
    try {
      const sanitizedMain = mainUrl.trim().replace(/^postgres(?:ql)?:\/\//i, 'http://');
      const parsedMain = new URL(sanitizedMain);
      mainHost = normalizeHost(parsedMain.hostname);
      mainPort = parsedMain.port || '5432';
    } catch {
      // Mantém localhost:5432 como fallback de proteção
    }
  }

  const isSameHost = testHost === mainHost;
  const isSamePort = testPort === mainPort;

  if (isSameHost && isSamePort) {
    return {
      valid: false,
      reason: `TEST_DATABASE_URL aponta para a mesma instância (${testHost}:${testPort}) do PostgreSQL pessoal. Testes devem rodar em instância separada (ex: container isolado em outra porta).`,
    };
  }

  // 5. O banco de testes deve ter identificador explícito de teste
  if (!testDbName.includes('test')) {
    return {
      valid: false,
      reason: `O banco de teste '${testDbName}' não possui identificador explícito 'test'`,
    };
  }

  return { valid: true };
}

function createFailClosedClient(rejectionReason?: string): PrismaClient {
  const failClosedMessage = (target: string) => {
    const detail = rejectionReason ? `\nMotivo da rejeição: ${rejectionReason}` : '';
    return (
      `[Prisma Fail-Closed] Conexão/operação '${target}' bloqueada em ambiente de testes!${detail}\n` +
      `O acesso ao banco pessoal 'horacerta' é estritamente proibido durante testes automatizados.\n` +
      `Para testes com banco real, configure TEST_DATABASE_URL apontando para uma instância isolada (ex: container em porta separada com db *_test).\n` +
      `Para testes unitários, utilize vi.spyOn ou mocks nos repositories/prisma.`
    );
  };

  const baseClient = new PrismaClient({
    datasources: {
      db: {
        // Roteia para porta de loopback não padrão garantindo isolamento total de rede
        url: 'postgresql://fail_closed_test:blocked@127.0.0.1:54329/horacerta_test_blocked?schema=blocked',
      },
    },
    log: [],
  });

  const extendedClient = baseClient.$extends({
    client: {
      $transaction(..._args: unknown[]) {
        return Promise.reject(new Error(failClosedMessage('$transaction')));
      },
      $queryRaw(..._args: unknown[]) {
        return Promise.reject(new Error(failClosedMessage('$queryRaw')));
      },
      $queryRawUnsafe(..._args: unknown[]) {
        return Promise.reject(new Error(failClosedMessage('$queryRawUnsafe')));
      },
      $executeRaw(..._args: unknown[]) {
        return Promise.reject(new Error(failClosedMessage('$executeRaw')));
      },
      $executeRawUnsafe(..._args: unknown[]) {
        return Promise.reject(new Error(failClosedMessage('$executeRawUnsafe')));
      },
      $connect() {
        return Promise.reject(new Error(failClosedMessage('$connect')));
      },
    },
    query: {
      $allModels: {
        $allOperations({ model, operation }) {
          throw new Error(failClosedMessage(`${model}.${operation}`));
        },
      },
    },
  });

  return extendedClient as unknown as PrismaClient;
}

function initPrisma(): PrismaClient {
  if (isTest) {
    const testUrl = process.env.TEST_DATABASE_URL;
    const mainUrl = process.env.DATABASE_URL;

    const validation = validateTestDatabaseUrl(testUrl, mainUrl);
    if (validation.valid && testUrl) {
      return new PrismaClient({
        datasources: { db: { url: testUrl } },
      });
    }

    return createFailClosedClient(validation.reason);
  }

  return new PrismaClient();
}

export const prisma = initPrisma();
