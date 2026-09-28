import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get('/', (req, res, next) => settingsController.getSettings(req, res, next));
settingsRouter.put('/profile', (req, res, next) => settingsController.updateProfile(req, res, next));
settingsRouter.put('/work-schedule', (req, res, next) => settingsController.updateWorkSchedule(req, res, next));

export { settingsRouter };
