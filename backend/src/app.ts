import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { routes } from './routes';
import { errorHandler } from './middlewares/error-handler';

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(routes);
app.use(errorHandler);

export default app;
