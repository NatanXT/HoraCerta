import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3333,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL || '',
};
