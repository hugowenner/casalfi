// ── Payload enviado pelo Telegram a cada evento ───────────────────────────
// Documentação: https://core.telegram.org/bots/api#update
// Só mapeamos os campos que realmente usamos no CASALFI.

export interface TelegramUpdate {
  update_id: number;            // ID único e crescente — usado para idempotência
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;          // Ausente em canais
  chat: TelegramChat;
  date: number;                 // Unix timestamp
  text?: string;                // Ausente em fotos, stickers, etc.
}

export interface TelegramUser {
  id: number;                   // ID numérico imutável — é o que armazenamos em telegramId
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;            // Pode mudar — não usar como chave primária
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

// ── Inline keyboards ──────────────────────────────────────────────────────

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;       // Máx 64 bytes
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

// ── Callback query (clique em botão inline) ───────────────────────────────

export interface TelegramCallbackQuery {
  id: string;                   // Deve ser respondido com answerCallbackQuery
  from: TelegramUser;
  message?: TelegramMessage;    // Mensagem onde o botão foi clicado
  data?: string;                // callback_data do botão
}

// ── Resultado do parser de IA ─────────────────────────────────────────────

export interface ParsedTransaction {
  type: "income" | "expense";
  amount: number;
  category: string;             // Nome da categoria (ex: "Supermercado")
  description: string;
  confidence: number;           // 0-1
  splitType?: "individual" | "equal"; // Detectado por "dividido", "50/50" etc.
}

// ── Resposta bruta da IA (antes de validar) ───────────────────────────────

export interface RawAIResponse {
  type: string;
  amount: number | null;
  category: string;
  description: string;
  confidence: number;
  splitType?: string;
}
