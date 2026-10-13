import { z } from 'zod';
import { normalizeHex } from '../utils/color-contrast';

const hexColorSchema = z
  .string()
  .min(1, 'A cor HEX é obrigatória.')
  .transform((val, ctx) => {
    const normalized = normalizeHex(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Formato de cor HEX inválido. Use #RRGGBB.',
      });
      return z.NEVER;
    }
    return normalized;
  });

export const appearanceFavoriteSchema = z.object({
  id: z.string().min(1, 'O identificador do favorito é obrigatório.'),
  name: z.string().trim().min(1, 'O nome da cor é obrigatório.').max(30, 'O nome deve ter no máximo 30 caracteres.'),
  hex: hexColorSchema,
});

export const updateAppearanceSchema = z.object({
  mode: z.enum(['LIGHT', 'DARK'], {
    errorMap: () => ({ message: 'O modo deve ser LIGHT ou DARK.' }),
  }),
  accentHex: hexColorSchema,
  favorites: z
    .array(appearanceFavoriteSchema)
    .length(9, 'A paleta de favoritos deve conter exatamente 9 cores.'),
});

export type UpdateAppearanceInput = z.infer<typeof updateAppearanceSchema>;
