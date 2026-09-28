import { Request, Response, NextFunction } from 'express';
import { verifyToken, COOKIE_NAME } from '../utils/auth';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
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
  if (!payload) {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    return;
  }

  req.auth = payload;
  next();
}
