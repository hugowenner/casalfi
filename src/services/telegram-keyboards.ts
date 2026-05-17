// Builders para teclados inline do Telegram.
// Callback data usa o formato "ação:param" — máx 64 bytes.

import type { InlineKeyboardMarkup } from "@/types/telegram";

// ── Após criar transação ──────────────────────────────────────────────────
// Botões de ação rápida exibidos depois de uma transação ser registrada.

export function afterTransactionKeyboard(txId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: "↩️ Desfazer", callback_data: `undo_confirm:${txId}` },
      { text: "📊 Ver resumo", callback_data: "show_summary" },
    ]],
  };
}

// ── Confirmação de exclusão ───────────────────────────────────────────────
// Exibido quando o usuário pede para remover a última transação.

export function confirmDeleteKeyboard(txId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: "✅ Confirmar", callback_data: `do_delete:${txId}` },
      { text: "❌ Cancelar", callback_data: "cancel_delete" },
    ]],
  };
}

// ── Teclado vazio (remove botões de uma mensagem editada) ─────────────────

export const emptyKeyboard: InlineKeyboardMarkup = { inline_keyboard: [] };
