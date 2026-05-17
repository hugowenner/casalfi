import { z } from "zod";

// Valida só os campos que o CASALFI usa.
// Campos extras do Telegram são ignorados (strip por padrão no Zod).

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  is_bot: z.boolean(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

const telegramChatSchema = z.object({
  id: z.number().int(),
  type: z.enum(["private", "group", "supergroup", "channel"]),
});

const telegramMessageSchema = z.object({
  message_id: z.number().int().positive(),
  from: telegramUserSchema.optional(),
  chat: telegramChatSchema,
  date: z.number().int().positive(),
  text: z.string().optional(),
});

const telegramCallbackQuerySchema = z.object({
  id: z.string(),
  from: telegramUserSchema,
  message: telegramMessageSchema.optional(),
  data: z.string().optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: z.number().int().positive(),
  message: telegramMessageSchema.optional(),
  callback_query: telegramCallbackQuerySchema.optional(),
});

export type TelegramUpdateInput = z.infer<typeof telegramUpdateSchema>;
