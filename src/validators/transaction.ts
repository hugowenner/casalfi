import { z } from "zod";

export const transactionSchema = z.object({
  description: z
    .string()
    .min(1, "Descrição obrigatória")
    .max(120, "Descrição muito longa"),
  amount: z
    .number({ invalid_type_error: "Valor inválido" })
    .positive("Valor deve ser positivo"),
  type: z.enum(["income", "expense", "transfer"]),
  date: z.string().min(1, "Data obrigatória"),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  cardId: z.string().optional(),
  splitType: z.enum(["individual", "equal", "proportional", "custom"]).default("individual"),
  paidByUserId: z.string().min(1, "Quem pagou é obrigatório"),
  notes: z.string().max(500).optional(),
  isRecurring: z.boolean().default(false),
  recurringPeriod: z.enum(["weekly", "monthly", "yearly"]).optional(),
  installmentTotal: z.number().int().positive().optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

export const transactionFilterSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  type: z.enum(["income", "expense", "transfer", "all"]).default("all"),
  categoryId: z.string().optional(),
  search: z.string().optional(),
});

export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;
