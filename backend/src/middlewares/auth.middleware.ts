import { Request, Response, NextFunction } from 'express';
import { verifyToken, COOKIE_NAME } from '../utils/auth';
import { prisma } from '../lib/prisma';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined = req.cookies?.[COOKIE_NAME];

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Não autenticado.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    return;
  }

  // Validação segura de authVersion contra o banco de dados (Fail-Closed)
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, authVersion: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Usuário não encontrado ou inativo.' });
      return;
    }

    // Tratamento de compatibilidade para tokens legados e versionados:
    // Se o token possui authVersion: precisa ser estritamente igual à versão atual do usuário no banco.
    // Se o token for legado (sem authVersion): aceito apenas enquanto user.authVersion === 0 (usuário ainda não redefiniu senha).
    const isLegacyToken = payload.authVersion === undefined;

    if (isLegacyToken) {
      if (user.authVersion > 0) {
        res.status(401).json({ error: 'Sessão revogada após redefinição de senha.' });
        return;
      }
    } else {
      if (payload.authVersion !== user.authVersion) {
        res.status(401).json({ error: 'Sessão revogada após redefinição de senha.' });
        return;
      }
    }
  } catch (error) {
    // Comportamento FAIL-CLOSED: se o banco falhar ou estiver inacessível, NUNCA autoriza por fallback silencioso
    console.error('[requireAuth] Falha ao verificar integridade da sessão no banco:', (error as Error).message);
    res.status(503).json({ error: 'Serviço de validação de autenticação temporariamente indisponível.' });
    return;
  }

  req.auth = payload;
  next();
}
