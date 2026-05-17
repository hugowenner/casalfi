// Responsabilidade: comunicação com a Bot API do Telegram.
// Não contém lógica de negócio — só chamadas HTTP.

import type { InlineKeyboardMarkup } from "@/types/telegram";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

function hasToken(): boolean {
  if (!BOT_TOKEN) {
    console.error("[Telegram] TELEGRAM_BOT_TOKEN não definido");
    return false;
  }
  return true;
}

// ── sendMessage ───────────────────────────────────────────────────────────
// parse_mode = "Markdown" permite *negrito* e `código` nas respostas.
// Em caso de erro de Markdown tenta sem formatação.

export async function sendTelegramMessage(
  chatId: number,
  text: string
): Promise<void> {
  if (!hasToken()) return;

  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });

  if (!res.ok) {
    const fallback = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!fallback.ok) {
      console.error("[Telegram] sendMessage falhou:", await fallback.text());
    }
  }
}

// ── sendWithKeyboard ──────────────────────────────────────────────────────
// Envia mensagem com botões inline. Retorna o message_id ou undefined.

export async function sendWithKeyboard(
  chatId: number,
  text: string,
  keyboard: InlineKeyboardMarkup
): Promise<number | undefined> {
  if (!hasToken()) return;

  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }),
  });

  if (!res.ok) {
    console.error("[Telegram] sendWithKeyboard falhou:", await res.text());
    return;
  }

  const data = await res.json() as { ok: boolean; result?: { message_id: number } };
  return data.result?.message_id;
}

// ── editMessageText ───────────────────────────────────────────────────────
// Edita texto + teclado de uma mensagem existente (usada após callback_query).

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboardMarkup
): Promise<void> {
  if (!hasToken()) return;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "Markdown",
  };
  if (keyboard) body.reply_markup = keyboard;

  const res = await fetch(`${API_BASE}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("[Telegram] editMessageText falhou:", await res.text());
  }
}

// ── answerCallbackQuery ───────────────────────────────────────────────────
// Obrigatório após receber um callback_query: remove o "loading" no botão.
// text opcional aparece como toast no celular do usuário.

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  if (!hasToken()) return;

  await fetch(`${API_BASE}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// ── registerWebhook ───────────────────────────────────────────────────────
// Chamado uma vez durante o deploy (ou manualmente via script).

export async function registerTelegramWebhook(webhookUrl: string): Promise<void> {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN não definido");

  const res = await fetch(`${API_BASE}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "callback_query"],
    }),
  });

  const data = await res.json() as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`setWebhook falhou: ${data.description}`);
  console.log("[Telegram] Webhook registrado:", webhookUrl);
}
