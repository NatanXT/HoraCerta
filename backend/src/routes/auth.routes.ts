import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const authRouter = Router();

authRouter.post('/register', (req, res, next) => authController.register(req, res, next));
authRouter.post('/login', (req, res, next) => authController.login(req, res, next));
authRouter.post('/logout', (req, res) => authController.logout(req, res));
authRouter.get('/me', requireAuth, (req, res, next) => authController.me(req, res, next));

export { authRouter };
