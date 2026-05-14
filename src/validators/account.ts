import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(60),
  type: z.enum(["checking", "savings", "wallet", "investment"]),
  balance: z.number().default(0),
  color: z.string().optional(),
  icon: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export const cardSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(60),
  brand: z.string().optional(),
  lastFourDigits: z
    .string()
    .length(4, "Deve ter 4 dígitos")
    .regex(/^\d+$/, "Apenas números")
    .optional(),
  creditLimit: z.number().min(0).default(0),
  closingDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  color: z.string().optional(),
});

export type AccountInput = z.infer<typeof accountSchema>;
export type CardInput = z.infer<typeof cardSchema>;
