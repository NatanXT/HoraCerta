import express from 'express';
import cors from 'cors';
import { routes } from './routes';
import { errorHandler } from './middlewares/error-handler';

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(routes);
app.use(errorHandler);

export default app;
