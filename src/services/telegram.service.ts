// Responsabilidade: comunicação com a Bot API do Telegram.
// Não contém lógica de negócio — só chamadas HTTP.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── sendMessage ───────────────────────────────────────────────────────────
// parse_mode = "Markdown" permite *negrito* e `código` nas respostas.
// Não lança exceção se o Telegram falhar — logamos e seguimos.
// O Telegram rejeita mensagens com Markdown inválido; em caso de erro
// tentamos enviar sem formatação.

export async function sendTelegramMessage(
  chatId: number,
  text: string
): Promise<void> {
  if (!BOT_TOKEN) {
    console.error("[Telegram] TELEGRAM_BOT_TOKEN não definido");
    return;
  }

  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });

  if (!res.ok) {
    // Tenta sem Markdown (pode ser que o texto tenha caracteres especiais)
    const fallback = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!fallback.ok) {
      const err = await fallback.text();
      console.error("[Telegram] sendMessage falhou:", err);
    }
  }
}

// ── registerWebhook ───────────────────────────────────────────────────────
// Chamado uma vez durante o deploy (ou manualmente via script).
// secret_token: o Telegram envia este valor no header X-Telegram-Bot-Api-Secret-Token
// em cada requisição — usamos para validar que veio do Telegram de verdade.

export async function registerTelegramWebhook(webhookUrl: string): Promise<void> {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN não definido");

  const res = await fetch(`${API_BASE}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message"], // Só recebe mensagens de texto, ignora o resto
    }),
  });

  const data = await res.json() as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`setWebhook falhou: ${data.description}`);
  console.log("[Telegram] Webhook registrado:", webhookUrl);
}
