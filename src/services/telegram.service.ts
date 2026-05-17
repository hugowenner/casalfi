// Responsabilidade: comunicação com a Bot API do Telegram.
// Não contém lógica de negócio — só chamadas HTTP.

import type { InlineKeyboardMarkup } from "@/types/telegram";
import type { ReplyKeyboard } from "@/services/telegram-menus";

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
// parse_mode = "Markdown" com fallback sem formatação.

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

// ── sendWithPersistentMenu ────────────────────────────────────────────────
// Envia mensagem de texto junto com o menu ReplyKeyboard persistente.
// Usar após /start e após ações importantes para garantir que o menu apareça.

export async function sendWithPersistentMenu(
  chatId: number,
  text: string,
  menu: ReplyKeyboard
): Promise<void> {
  if (!hasToken()) return;

  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: menu,
    }),
  });

  if (!res.ok) {
    console.error("[Telegram] sendWithPersistentMenu falhou:", await res.text());
    // Fallback: envia sem o menu
    await sendTelegramMessage(chatId, text);
  }
}

// ── sendWithKeyboard ──────────────────────────────────────────────────────
// Envia mensagem com InlineKeyboard. Retorna o message_id ou undefined.

export async function sendWithKeyboard(
  chatId: number,
  text: string,
  keyboard: InlineKeyboardMarkup
): Promise<number | undefined> {
  if (!hasToken()) return;

  console.log("📦 FINAL MESSAGE PAYLOAD:", {
    chatId,
    textPreview: text.slice(0, 50),
    keyboard: JSON.stringify(keyboard),
  });
  console.log("🚀 SENDING TO TELEGRAM:", {
    hasReplyMarkup: !!keyboard,
    rowCount: keyboard.inline_keyboard.length,
    replyMarkup: keyboard,
  });

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
    // Fallback sem parse_mode — preserva o teclado mesmo com chars especiais na descrição
    const fallback = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: keyboard }),
    });
    if (!fallback.ok) {
      console.error("[Telegram] sendWithKeyboard falhou:", await fallback.text());
      return;
    }
    const fd = await fallback.json() as { ok: boolean; result?: { message_id: number } };
    return fd.result?.message_id;
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

  console.log("📦 FINAL MESSAGE PAYLOAD (edit):", {
    chatId,
    messageId,
    textPreview: text.slice(0, 50),
    keyboard: JSON.stringify(keyboard),
  });
  console.log("🚀 SENDING TO TELEGRAM (edit):", {
    hasReplyMarkup: !!keyboard,
    rowCount: keyboard?.inline_keyboard.length ?? 0,
    replyMarkup: keyboard,
  });

  const res = await fetch(`${API_BASE}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Fallback sem parse_mode — preserva o teclado mesmo com chars especiais
    const bodyFallback = { ...body };
    delete bodyFallback.parse_mode;
    const fallback = await fetch(`${API_BASE}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyFallback),
    });
    if (!fallback.ok) {
      console.error("[Telegram] editMessageText falhou:", await fallback.text());
    }
  }
}

// ── answerCallbackQuery ───────────────────────────────────────────────────
// Obrigatório após receber um callback_query — remove o "loading" no botão.
// text opcional aparece como toast de ~2s no celular do usuário.

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

// ── registerBotCommands ───────────────────────────────────────────────────
// Registra os comandos no menu "/" do Telegram (aparecem como sugestões).
// Chamado uma vez no setWebhook e também no /start.

export async function registerBotCommands(): Promise<void> {
  if (!BOT_TOKEN) return;

  await fetch(`${API_BASE}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "start", description: "Boas-vindas e menu principal" },
        { command: "resumo", description: "Resumo de gastos do mês" },
        { command: "ultimas", description: "Últimas transações" },
        { command: "desfazer", description: "Desfazer última transação" },
        { command: "gerenciar", description: "Editar ou excluir transações" },
        { command: "config", description: "Configurações" },
        { command: "ajuda", description: "Ajuda e exemplos" },
      ],
    }),
  });
}

// ── registerTelegramWebhook ───────────────────────────────────────────────

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

  // Registra comandos junto com o webhook
  await registerBotCommands();
  console.log("[Telegram] Webhook e comandos registrados:", webhookUrl);
}
