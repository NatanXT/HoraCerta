import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get('/', (req, res, next) => profileController.getProfile(req, res, next));
profileRouter.put('/', (req, res, next) => profileController.updateProfile(req, res, next));
profileRouter.put('/work-schedule', (req, res, next) => profileController.updateWorkSchedule(req, res, next));

export { profileRouter };
