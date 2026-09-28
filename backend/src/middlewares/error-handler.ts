import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. AppError instances
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // 2. Zod validation errors -> HTTP 400
  if (err instanceof ZodError) {
    const firstIssue = err.errors[0];
    const message = firstIssue?.message || 'Dados de requisição inválidos.';
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message,
      },
    });
    return;
  }

  // 3. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002' || err.code === 'P2034') {
      res.status(409).json({
        error: {
          code: 'CONCURRENCY_CONFLICT',
          message: 'Conflito de dados ou concorrência. Tente novamente.',
        },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Registro não encontrado.',
        },
      });
      return;
    }
  }

  // 4. Custom Errors attached with statusCode
  if (typeof (err as any).statusCode === 'number') {
    const statusCode = (err as any).statusCode;
    res.status(statusCode).json({
      error: {
        code: statusCode === 409 ? 'CONFLICT' : statusCode === 400 ? 'BAD_REQUEST' : 'ERROR',
        message: err.message || 'Ocorreu um erro na requisição.',
      },
    });
    return;
  }

  console.error('[Unhandled Error]', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor.',
    },
  });
}
