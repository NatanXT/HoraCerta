import { Router } from 'express';
import { workSessionController } from '../controllers/work-session.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const workSessionRouter = Router();

workSessionRouter.use(requireAuth);

workSessionRouter.post('/start', (req, res, next) => workSessionController.start(req, res, next));
workSessionRouter.post('/pause', (req, res, next) => workSessionController.pause(req, res, next));
workSessionRouter.post('/resume', (req, res, next) => workSessionController.resume(req, res, next));
workSessionRouter.post('/finish', (req, res, next) => workSessionController.finish(req, res, next));
workSessionRouter.post('/reconcile', (req, res, next) => workSessionController.reconcile(req, res, next));

export { workSessionRouter };
