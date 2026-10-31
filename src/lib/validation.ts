import { z } from 'zod';

const optionalText = (max = 500) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional()
  );

const optionalNumber = (min?: number, max?: number) =>
  z.preprocess(
    (value) => (value === '' || value == null ? undefined : Number(value)),
    z
      .number({ invalid_type_error: 'Enter a valid number' })
      .refine((n) => !Number.isNaN(n), 'Enter a valid number')
      .refine((n) => min == null || n >= min, min == null ? '' : `Must be at least ${min}`)
      .refine((n) => max == null || n <= max, max == null ? '' : `Must be at most ${max}`)
      .optional()
  );

const optionalId = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.string().uuid('Select a valid record').optional()
);

const dateString = z
  .string()
  .min(1, 'Choose a date')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date');

const optionalDate = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date').optional()
);

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(100),
    email: z.string().trim().email('Enter a valid email address'),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
    language: z.enum(['en', 'mr', 'hi']).default('en'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

export const passwordChangeSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm the new password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const farmSchema = z.object({
  name: z.string().trim().min(2, 'Give the farm a name').max(120),
  state: optionalText(80),
  district: optionalText(80),
  taluka: optionalText(80),
  village: optionalText(80),
  latitude: optionalNumber(-90, 90),
  longitude: optionalNumber(-180, 180),
  total_area: optionalNumber(0.0001, 1000000),
  area_unit: z.enum(['acres', 'hectares', 'guntha']).default('acres'),
  soil_type: optionalText(60),
  soil_ph: optionalNumber(0, 14),
  irrigation_available: z.boolean().default(false),
  water_source: optionalText(80),
  land_slope: optionalText(40),
  farming_season: z.enum(['kharif', 'rabi', 'zaid', 'annual']).optional(),
  annual_budget: optionalNumber(0, 100000000),
  is_primary: z.boolean().optional(),
});

export const fieldSchema = z.object({
  name: z.string().trim().min(1, 'Name the field').max(120),
  area: optionalNumber(0.0001, 1000000),
  area_unit: z.enum(['acres', 'hectares', 'guntha']).default('acres'),
  soil_type: optionalText(60),
  soil_ph: optionalNumber(0, 14),
  irrigation_available: z.boolean().default(false),
  water_source: optionalText(80),
  notes: optionalText(1000),
});

export const farmCropSchema = z.object({
  crop_id: z.string().uuid('Choose a crop'),
  field_id: optionalId,
  variety: optionalText(120),
  sowing_date: optionalDate,
  expected_harvest_date: optionalDate,
  area_planted: optionalNumber(0.0001, 1000000),
  area_unit: z.enum(['acres', 'hectares', 'guntha']).default('acres'),
  seed_quantity: optionalNumber(0, 1000000),
  seed_cost: optionalNumber(0, 100000000),
  notes: optionalText(1000),
});

export const activitySchema = z.object({
  farm_crop_id: z.string().uuid(),
  activity_type: z.enum([
    'sowing', 'irrigation', 'fertilizer', 'pesticide', 'weeding',
    'pruning', 'harvesting', 'observation', 'other',
  ]),
  activity_date: dateString,
  description: optionalText(500),
  quantity: optionalNumber(0, 100000000),
  unit: optionalText(30),
  cost: optionalNumber(0, 100000000),
  notes: optionalText(1000),
});

export const expenseSchema = z.object({
  farm_id: z.string().uuid('Choose a farm'),
  farm_crop_id: optionalId,
  category: z.enum([
    'seeds', 'fertilizers', 'pesticides', 'labour', 'machinery', 'irrigation',
    'electricity', 'transportation', 'fuel', 'land_preparation', 'equipment', 'other',
  ]),
  amount: z.coerce.number().positive('Enter an amount greater than zero'),
  expense_date: dateString,
  description: optionalText(500),
  payment_method: optionalText(60),
  vendor: optionalText(160),
  notes: optionalText(1000),
});

export const incomeSchema = z.object({
  farm_id: z.string().uuid('Choose a farm'),
  farm_crop_id: optionalId,
  category: z.enum(['crop_sale', 'product_sale', 'subsidy', 'insurance', 'other']),
  amount: z.coerce.number().positive('Enter an amount greater than zero'),
  income_date: dateString,
  description: optionalText(500),
  quantity: optionalNumber(0, 100000000),
  unit: optionalText(30),
  price_per_unit: optionalNumber(0, 100000000),
  buyer: optionalText(160),
  market_name: optionalText(160),
  notes: optionalText(1000),
});

export const soilSchema = z.object({
  field_id: optionalId,
  test_date: optionalDate,
  soil_type: optionalText(60),
  ph: optionalNumber(0, 14),
  organic_carbon: optionalNumber(0, 100),
  nitrogen: optionalNumber(0, 10000),
  phosphorus: optionalNumber(0, 10000),
  potassium: optionalNumber(0, 10000),
  lab_name: optionalText(160),
  notes: optionalText(1000),
});

export const taskSchema = z.object({
  title: z.string().trim().min(2, 'Give the task a title').max(160),
  description: optionalText(1000),
  due_date: optionalDate,
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  farm_crop_id: optionalId,
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: z.preprocess(
    (value) => (value === '' || value == null ? undefined : value),
    z
      .string()
      .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number')
      .optional()
  ),
  preferred_language: z.enum(['en', 'mr', 'hi']),
});

export const marketImportSchema = z.object({
  fileName: z.string().min(1),
  records: z
    .array(
      z.object({
        commodity: z.string().min(1),
        state: z.string(),
        district: z.string(),
        market_name: z.string().min(1),
        variety: z.string().nullable(),
        min_price: z.number().nullable(),
        max_price: z.number().nullable(),
        modal_price: z.number().positive(),
        arrival_date: z.string(),
        source_url: z.string().nullable(),
      })
    )
    .min(1, 'No valid rows found in this CSV'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type FarmInput = z.infer<typeof farmSchema>;
export type FieldInput = z.infer<typeof fieldSchema>;
export type FarmCropInput = z.infer<typeof farmCropSchema>;
export type ActivityInput = z.infer<typeof activitySchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type IncomeInput = z.infer<typeof incomeSchema>;
export type SoilInput = z.infer<typeof soilSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;

/** First field error for simple form display. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Please check the form and try again.';
}
