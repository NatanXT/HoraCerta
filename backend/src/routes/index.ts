import { Router } from 'express';
import { healthRouter } from './health.routes';

const routes = Router();

routes.use('/health', healthRouter);

export { routes };
