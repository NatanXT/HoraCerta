import { Router } from 'express';
import { calendarOccurrenceController } from '../controllers/calendar-occurrence.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const calendarOccurrenceRouter = Router();

calendarOccurrenceRouter.use(requireAuth);

calendarOccurrenceRouter.get('/', (req, res, next) =>
  calendarOccurrenceController.list(req, res, next)
);
calendarOccurrenceRouter.post('/', (req, res, next) =>
  calendarOccurrenceController.create(req, res, next)
);
calendarOccurrenceRouter.put('/:id', (req, res, next) =>
  calendarOccurrenceController.update(req, res, next)
);
calendarOccurrenceRouter.delete('/:id', (req, res, next) =>
  calendarOccurrenceController.delete(req, res, next)
);

export { calendarOccurrenceRouter };
