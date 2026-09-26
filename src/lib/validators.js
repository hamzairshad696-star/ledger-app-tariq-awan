import { z } from 'zod';
import { isValidISODate } from './dates.js';

const trimmed = (max) => z.string().trim().max(max);
const amount = z.coerce.number({ invalid_type_error: 'must be a number' }).finite().nonnegative('cannot be negative').max(1_000_000_000);
const positiveAmount = z.coerce.number({ invalid_type_error: 'must be a number' }).finite().positive('must be greater than zero').max(1_000_000_000);
const isoDate = z.string().refine(isValidISODate, 'must be a valid date (YYYY-MM-DD)');
const year = z.coerce.number().int().min(2000).max(2100);
const month = z.coerce.number().int().min(1).max(12);

export const loginSchema = z.object({
  username: trimmed(50).min(1, 'is required'),
  password: z.string().min(1, 'is required').max(200),
});

export const personSchema = z.object({
  sr_no: z.coerce.number().int().positive('must be a positive number').optional().nullable(),
  name: trimmed(120).min(1, 'is required'),
  father_name: trimmed(120).min(1, 'is required'),
  status: z.enum(['active', 'inactive']).default('active'),
  marital_status: z.enum(['married', 'unmarried'], { errorMap: () => ({ message: 'choose Married or Unmarried' }) }),
  split_cash: amount.default(0),
  account: trimmed(60).default(''),
  monthly_amount: amount,
  joining_date: z.union([isoDate, z.literal(''), z.null()]).optional().transform((v) => v || null),
  notes: trimmed(2000).default(''),
  apply_amount_to_open_months: z.boolean().optional().default(true),
});

export const ledgerMonthSchema = z.object({
  person_id: z.coerce.number().int().positive(),
  year,
  month,
  required_amount: amount,
  notes: trimmed(500).default(''),
});

export const allocationSchema = z.object({ year, month, amount: positiveAmount });

export const advanceSchema = z.object({
  person_id: z.coerce.number().int().positive(),
  payment_date: isoDate,
  total_amount: positiveAmount,
  allocations: z.array(allocationSchema).min(1, 'select at least one future month'),
  notes: trimmed(1000).default(''),
});

export const paymentSchema = z.object({
  person_id: z.coerce.number().int().positive(),
  year,
  month,
  amount: positiveAmount,
  payment_date: isoDate,
  method: z.enum(['cash', 'bank', 'cheque', 'online', 'other']).default('cash'),
  reference: trimmed(80).default(''),
  notes: trimmed(1000).default(''),
  // Optional advance recorded in the same transaction (March payment + April/May advance)
  advance: advanceSchema.omit({ person_id: true, payment_date: true }).optional().nullable(),
});

export const viewerSchema = z.object({
  username: trimmed(50).min(3, 'must be at least 3 characters').regex(/^[a-zA-Z0-9._-]+$/, 'may only contain letters, numbers, dot, dash and underscore'),
  name: trimmed(120).min(1, 'is required'),
  password: z.string().max(200).optional().nullable(),
  is_active: z.boolean().default(true),
  person_ids: z.array(z.coerce.number().int().positive()).default([]),
});

export const passwordRule = z.string().min(8, 'must be at least 8 characters').max(200);

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'is required'),
  new_password: passwordRule,
});

export const closingActionSchema = z.object({
  action: z.enum(['close', 'reopen']),
  confirm: z.literal(true, { errorMap: () => ({ message: 'confirmation is required' }) }),
  reason: trimmed(500).optional().default(''),
});

export const yearSchema = z.object({ year });
export { year as yearParam, month as monthParam };
