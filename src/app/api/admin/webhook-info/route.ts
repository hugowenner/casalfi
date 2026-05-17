// Retorna o estado atual do webhook registrado no Telegram.
// Útil para diagnóstico: URL ativa, último erro, pendências.

import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN não definido" }, { status: 500 });
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const data = await res.json();
  return NextResponse.json(data);
}
