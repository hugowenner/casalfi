// Endpoint POST que recebe eventos do Telegram (webhook).
//
// IMPORTANTE: sempre retornar 200 OK, mesmo em erros.
// Se retornar outro status, o Telegram retentar por 24h → transações duplicadas.
//
// Segurança: validamos X-Telegram-Bot-Api-Secret-Token antes de processar.
// Processamento: fire-and-forget para responder ao Telegram em <1s.

import { NextRequest, NextResponse } from "next/server";
import { telegramUpdateSchema } from "@/validators/telegram.validator";
import { handleTelegramUpdate } from "@/services/telegram-transaction.service";

// Idempotência simples: mantém os últimos 500 update_ids em memória.
// Limitação: reinicia com cada cold start em serverless.
// Produção com alta carga: substituir por Upstash Redis.
const processedUpdateIds = new Set<number>();
const MAX_CACHE_SIZE = 500;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Validar origem pelo secret ──────────────────────────────────────
  const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token");
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret || incomingSecret !== expectedSecret) {
    console.warn("[Telegram Webhook] Secret inválido.", {
      envSet: !!expectedSecret,
      envFirst8: expectedSecret?.substring(0, 8),
      incomingFirst8: incomingSecret?.substring(0, 8),
    });
    return NextResponse.json({ ok: true });
  }

  // ── 2. Parsear e validar o body ────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Body malformado — ignorar silenciosamente
    return NextResponse.json({ ok: true });
  }

  const parsed = telegramUpdateSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("[Telegram Webhook] Payload inválido:", parsed.error.flatten());
    return NextResponse.json({ ok: true });
  }

  const update = parsed.data;

  // ── 3. Idempotência — evitar processar o mesmo update duas vezes ───────
  if (processedUpdateIds.has(update.update_id)) {
    console.log("[Telegram Webhook] Update duplicado ignorado:", update.update_id);
    return NextResponse.json({ ok: true });
  }

  // Controla o tamanho do Set (evita vazamento de memória)
  if (processedUpdateIds.size >= MAX_CACHE_SIZE) {
    const first = processedUpdateIds.values().next().value;
    if (first !== undefined) processedUpdateIds.delete(first);
  }
  processedUpdateIds.add(update.update_id);

  // ── 4. Processar de forma assíncrona (fire-and-forget) ─────────────────
  console.log("[Telegram Webhook] Update recebido:", update.update_id, update.message?.text);
  handleTelegramUpdate(update).catch((err: unknown) => {
    console.error("[Telegram Webhook] Erro ao processar update:", err);
  });

  return NextResponse.json({ ok: true });
}
