import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { routes } from './routes';

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(routes);

export default app;
