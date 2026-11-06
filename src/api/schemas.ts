import { z } from 'zod';

export const errorResponseDtoSchema = z.object({
  message: z.string(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })),
});

export type ErrorResponseDto = z.infer<typeof errorResponseDtoSchema>;

export const activityStatusSchema = z.enum([
  'draft',
  'published',
  'confirmed',
  'sold-out',
  'done',
  'cancelled',
]);

const isoDateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date');

export const activityDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  price: z.number(),
  date: isoDateString,
  duration: z.number(),
  location: z.string(),
  minParticipants: z.number(),
  maxParticipants: z.number(),
  status: activityStatusSchema,
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type ActivityDto = z.infer<typeof activityDtoSchema>;

export const authResponseDtoSchema = z.object({
  user: z.object({
    id: z.number(),
    username: z.string(),
    email: z.string(),
    terms: z.boolean(),
  }),
  accessToken: z.string(),
});

export type AuthResponseDto = z.infer<typeof authResponseDtoSchema>;

export const paymentStatusSchema = z.enum(['pending', 'paid', 'refunded']);

export const bookingDtoSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  userId: z.string(),
  participants: z.number(),
  createdAt: isoDateString,
  paymentId: z.string().optional(),
  paymentStatus: paymentStatusSchema.optional(),
});

export type BookingDto = z.infer<typeof bookingDtoSchema>;

export const bookingWithActivityDtoSchema = bookingDtoSchema.extend({
  paymentStatus: paymentStatusSchema,
  activity: z.object({
    name: z.string(),
    slug: z.string(),
    price: z.number(),
    date: isoDateString,
    duration: z.number(),
    location: z.string(),
    status: activityStatusSchema,
  }),
});

export type BookingWithActivityDto = z.infer<typeof bookingWithActivityDtoSchema>;
