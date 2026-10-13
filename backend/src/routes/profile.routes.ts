import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';
import { appearanceController } from '../controllers/appearance.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get('/appearance', (req, res, next) => appearanceController.getAppearance(req, res, next));
profileRouter.put('/appearance', (req, res, next) => appearanceController.updateAppearance(req, res, next));

profileRouter.get('/', (req, res, next) => profileController.getProfile(req, res, next));
profileRouter.put('/', (req, res, next) => profileController.updateProfile(req, res, next));
profileRouter.put('/work-schedule', (req, res, next) => profileController.updateWorkSchedule(req, res, next));

export { profileRouter };
