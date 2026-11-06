import { z } from 'zod';
import { MailboxProvider, OrderStatus } from '@prisma/client';

const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const createOrderSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Domain must be at least 3 characters')
    .max(253, 'Domain is too long')
    .regex(domainRegex, 'Invalid domain format (e.g. example.com)'),
  provider: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.nativeEnum(MailboxProvider, {
      errorMap: () => ({ message: 'Provider must be either GOOGLE or MICROSOFT' }),
    })
  ),
  mailboxCount: z.coerce
    .number()
    .int('Mailbox count must be an integer')
    .min(1, 'Mailbox count must be at least 1')
    .max(50, 'Mailbox count cannot exceed 50'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  provider: z.nativeEnum(MailboxProvider).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type OrderQueryInput = z.infer<typeof orderQuerySchema>;

