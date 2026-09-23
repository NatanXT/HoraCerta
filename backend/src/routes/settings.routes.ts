import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';

const settingsRouter = Router();

settingsRouter.get('/', settingsController.getSettings.bind(settingsController));
settingsRouter.put('/profile', settingsController.updateProfile.bind(settingsController));
settingsRouter.put('/work-schedule', settingsController.updateWorkSchedule.bind(settingsController));

export { settingsRouter };
