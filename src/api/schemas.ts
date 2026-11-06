import { z } from 'zod';

export const errorResponseDtoSchema = z.object({
  message: z.string(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })),
});

export type ErrorResponseDto = z.infer<typeof errorResponseDtoSchema>;
