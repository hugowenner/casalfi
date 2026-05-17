// Rota de admin para registrar o webhook do Telegram.
// Acesse via GET para apontar o bot para esta URL de deploy.
// DELETE esta rota depois de usar em produção.

import { NextResponse } from "next/server";
import { registerTelegramWebhook } from "@/services/telegram.service";

export async function GET(): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL não definido" }, { status: 500 });
  }

  const webhookUrl = `${appUrl}/api/webhooks/telegram`;

  try {
    await registerTelegramWebhook(webhookUrl);
    return NextResponse.json({ ok: true, webhook: webhookUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
