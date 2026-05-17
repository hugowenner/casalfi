// Rota de admin para registrar o webhook do Telegram.
// Acesse via GET para apontar o bot para esta URL de deploy.
// DELETE esta rota depois de usar em produção.

import { NextRequest, NextResponse } from "next/server";
import { registerTelegramWebhook } from "@/services/telegram.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Usa a origem real da request — funciona em preview e produção sem depender de env
  const origin = new URL(request.url).origin;
  const webhookUrl = `${origin}/api/webhooks/telegram`;

  try {
    await registerTelegramWebhook(webhookUrl);
    return NextResponse.json({ ok: true, webhook: webhookUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
