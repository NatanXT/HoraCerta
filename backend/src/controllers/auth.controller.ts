import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { generateToken, setAuthCookie, clearAuthCookie } from '../utils/auth';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = registerSchema.parse(req.body);
      const user = await authService.register(input);
      const token = generateToken({ userId: user.id, email: user.email, name: user.name });
      setAuthCookie(res, token);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const user = await authService.login(input);
      const token = generateToken({ userId: user.id, email: user.email, name: user.name });
      setAuthCookie(res, token);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  async logout(_req: Request, res: Response): Promise<void> {
    clearAuthCookie(res);
    res.json({ message: 'Logout realizado com sucesso' });
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ error: 'Não autenticado.' });
        return;
      }
      const user = await authService.getMe(req.auth.userId);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
