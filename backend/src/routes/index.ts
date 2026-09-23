import { Router } from 'express';
import { healthRouter } from './health.routes';
import { workDayRouter } from './work-day.routes';
import { timeEntryRouter } from './time-entry.routes';
import { bankHoursRouter } from './bank-hours.routes';
import { settingsRouter } from './settings.routes';
import { calendarOccurrenceRouter } from './calendar-occurrence.routes';
import { reportRouter } from './report.routes';

const routes = Router();

routes.use('/health', healthRouter);
routes.use('/api/work-days', workDayRouter);
routes.use('/api/time-entries', timeEntryRouter);
routes.use('/api/bank-hours', bankHoursRouter);
routes.use('/api/settings', settingsRouter);
routes.use('/api/calendar-occurrences', calendarOccurrenceRouter);
routes.use('/api/reports', reportRouter);

export { routes };


