import { describe, it, expect, vi } from 'vitest';
import { prisma, validateTestDatabaseUrl } from './prisma';

describe('Prisma Fail-Closed Protection (ETAPA 12.0.2)', () => {
  it('deve bloquear qualquer operação direta em models no banco pessoal/produção horacerta', async () => {
    await expect(prisma.user.findFirst()).rejects.toThrow(
      /\[Prisma Fail-Closed\] Conexão\/operação 'User\.findFirst' bloqueada em ambiente de testes!/
    );
  });

  it('deve bloquear $transaction contra o banco pessoal/produção', async () => {
    await expect(prisma.$transaction(async () => {})).rejects.toThrow(
      /\[Prisma Fail-Closed\] Conexão\/operação '\$transaction' bloqueada em ambiente de testes!/
    );
  });

  it('deve bloquear $queryRaw contra o banco pessoal/produção', async () => {
    await expect(prisma.$queryRaw`SELECT 1`).rejects.toThrow(
      /\[Prisma Fail-Closed\] Conexão\/operação '\$queryRaw' bloqueada em ambiente de testes!/
    );
  });

  it('deve bloquear $queryRawUnsafe contra o banco pessoal/produção', async () => {
    await expect((prisma as any).$queryRawUnsafe('SELECT 1')).rejects.toThrow(
      /\[Prisma Fail-Closed\] Conexão\/operação '\$queryRawUnsafe' bloqueada em ambiente de testes!/
    );
  });

  it('deve bloquear $executeRaw contra o banco pessoal/produção', async () => {
    await expect(prisma.$executeRaw`DELETE FROM "User"`).rejects.toThrow(
      /\[Prisma Fail-Closed\] Conexão\/operação '\$executeRaw' bloqueada em ambiente de testes!/
    );
  });

  it('deve bloquear $executeRawUnsafe contra o banco pessoal/produção', async () => {
    await expect((prisma as any).$executeRawUnsafe('DROP TABLE test')).rejects.toThrow(
      /\[Prisma Fail-Closed\] Conexão\/operação '\$executeRawUnsafe' bloqueada em ambiente de testes!/
    );
  });

  it('deve bloquear $connect contra o banco pessoal/produção', async () => {
    await expect(prisma.$connect()).rejects.toThrow(
      /\[Prisma Fail-Closed\] Conexão\/operação '\$connect' bloqueada em ambiente de testes!/
    );
  });

  it('deve permitir que testes unitários funcionem normalmente através de mocks (vi.spyOn)', async () => {
    const mockUser = {
      id: 'mock-id-1',
      name: 'Usuário Mock',
      email: 'mock@horacerta.local',
      passwordHash: null,
      authVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const spy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

    const result = await prisma.user.findUnique({ where: { id: 'mock-id-1' } });
    expect(result).toEqual(mockUser);
    expect(spy).toHaveBeenCalledWith({ where: { id: 'mock-id-1' } });

    spy.mockRestore();
  });
});

describe('Validação Rigorosa e Isolamento de TEST_DATABASE_URL', () => {
  const mainUrl = 'postgresql://postgres:secret123@localhost:5432/horacerta?schema=public';

  it('deve rejeitar TEST_DATABASE_URL ausente ou vazia', () => {
    expect(validateTestDatabaseUrl(undefined, mainUrl).valid).toBe(false);
    expect(validateTestDatabaseUrl('', mainUrl).valid).toBe(false);
    expect(validateTestDatabaseUrl('   ', mainUrl).valid).toBe(false);
  });

  it('deve rejeitar URLs com protocolo inválido (http, mysql, etc.)', () => {
    const resHttp = validateTestDatabaseUrl('http://localhost:5432/horacerta_test', mainUrl);
    expect(resHttp.valid).toBe(false);
    expect(resHttp.reason).toContain('Protocolo inválido');

    const resMysql = validateTestDatabaseUrl('mysql://localhost:3306/horacerta_test', mainUrl);
    expect(resMysql.valid).toBe(false);
    expect(resMysql.reason).toContain('Protocolo inválido');
  });

  it('deve rejeitar URLs malformadas ou inválidas', () => {
    const result = validateTestDatabaseUrl('postgresql://invalid url with spaces', mainUrl);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('inválido ou malformado');
  });

  it('deve rejeitar quando o nome do banco apontar para "horacerta"', () => {
    const result = validateTestDatabaseUrl('postgresql://postgres:secret@localhost:5433/horacerta', mainUrl);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('pessoal/produção');
  });

  it('deve rejeitar bases reservadas do PostgreSQL (postgres, template0, template1)', () => {
    expect(validateTestDatabaseUrl('postgresql://postgres:secret@localhost:5433/postgres', mainUrl).valid).toBe(false);
    expect(validateTestDatabaseUrl('postgresql://postgres:secret@localhost:5433/template0', mainUrl).valid).toBe(false);
    expect(validateTestDatabaseUrl('postgresql://postgres:secret@localhost:5433/template1', mainUrl).valid).toBe(false);
  });

  it('BLOQUEIO CRÍTICO: deve rejeitar banco de teste na MESMA instância do banco pessoal (localhost:5432)', () => {
    // Mesmo com nome horacerta_test, a porta 5432 na mesma máquina pessoal DEVE ser bloqueada!
    const result = validateTestDatabaseUrl('postgresql://postgres:secret@localhost:5432/horacerta_test', mainUrl);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('mesma instância');
  });

  it('BLOQUEIO CRÍTICO: deve tratar aliases locais (127.0.0.1, ::1) como mesma instância e rejeitar', () => {
    const resIpv4 = validateTestDatabaseUrl('postgresql://postgres:secret@127.0.0.1:5432/horacerta_test', mainUrl);
    expect(resIpv4.valid).toBe(false);
    expect(resIpv4.reason).toContain('mesma instância');

    const resIpv6 = validateTestDatabaseUrl('postgresql://postgres:secret@[::1]:5432/horacerta_test', mainUrl);
    expect(resIpv6.valid).toBe(false);
    expect(resIpv6.reason).toContain('mesma instância');
  });

  it('deve proteger mesmo quando DATABASE_URL principal estiver ausente ou inválida', () => {
    const result = validateTestDatabaseUrl('postgresql://postgres:secret@localhost:5432/horacerta_test', undefined);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('mesma instância');
  });

  it('deve rejeitar bancos que não contenham "test" no nome (evita outros bancos reais)', () => {
    const result = validateTestDatabaseUrl('postgresql://postgres:secret@localhost:5433/banco_cliente', mainUrl);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('não possui identificador explícito');
  });

  it('deve aprovar uma URL que aponte para uma instância comprovadamente isolada (porta diferente e nome test)', () => {
    const result = validateTestDatabaseUrl(
      'postgresql://postgres:test_pass@localhost:5433/horacerta_isolated_test?schema=public',
      mainUrl
    );
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
