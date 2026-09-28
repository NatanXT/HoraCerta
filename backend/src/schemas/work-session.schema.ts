import { z } from 'zod';

export const pauseSessionSchema = z.object({
  type: z.enum(['SNACK', 'LUNCH'], {
    errorMap: () => ({ message: 'Tipo de pausa inválido. Use SNACK ou LUNCH.' }),
  }),
});

export type PauseSessionInput = z.infer<typeof pauseSessionSchema>;
