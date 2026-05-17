// Builders para teclados inline do Telegram.
//
// Convenção de callback_data: "namespace:action:param"
//   undo:confirm:txId  → pede confirmação de exclusão
//   undo:do:txId       → confirma exclusão
//   undo:cancel        → cancela exclusão
//   cat:expense:Nome   → seleciona categoria de despesa
//   cat:income:Nome    → seleciona categoria de receita
//   latest:page:N      → navega para página N
//   sum:show           → exibe resumo mensal
//   add:expense        → inicia fluxo de despesa
//   add:income         → inicia fluxo de receita
//   cfg:menu           → abre menu de config
//   cfg:close          → fecha menu de config
//   cfg:daily          → (futuro) resumo diário
//   cfg:goals          → (futuro) metas
//   cfg:categories     → (futuro) categorias

import type { InlineKeyboardMarkup } from "@/types/telegram";

// ── Pós-transação ─────────────────────────────────────────────────────────

export function afterExpenseKeyboard(txId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "↩️ Desfazer", callback_data: `undo:confirm:${txId}` },
        { text: "➕ Outro gasto", callback_data: "add:expense" },
      ],
      [{ text: "📊 Ver resumo", callback_data: "sum:show" }],
    ],
  };
}

export function afterIncomeKeyboard(txId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "↩️ Desfazer", callback_data: `undo:confirm:${txId}` },
        { text: "➕ Outra receita", callback_data: "add:income" },
      ],
      [{ text: "📊 Ver resumo", callback_data: "sum:show" }],
    ],
  };
}

// ── Confirmação de exclusão ───────────────────────────────────────────────

export function confirmDeleteKeyboard(txId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: "✅ Confirmar", callback_data: `undo:do:${txId}` },
      { text: "❌ Cancelar", callback_data: "undo:cancel" },
    ]],
  };
}

// ── Aguardando valor (após escolher categoria) ────────────────────────────

export function cancelFlowKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: "❌ Cancelar", callback_data: "undo:cancel" },
    ]],
  };
}

// ── Seleção de categoria de despesa ──────────────────────────────────────

export function expenseCategoryKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "🍔 Alimentação", callback_data: "cat:expense:Alimentação" },
        { text: "🛒 Supermercado", callback_data: "cat:expense:Supermercado" },
      ],
      [
        { text: "🚗 Transporte", callback_data: "cat:expense:Transporte" },
        { text: "🏠 Moradia", callback_data: "cat:expense:Moradia" },
      ],
      [
        { text: "💊 Saúde", callback_data: "cat:expense:Saúde" },
        { text: "📚 Educação", callback_data: "cat:expense:Educação" },
      ],
      [
        { text: "🎮 Lazer", callback_data: "cat:expense:Lazer" },
        { text: "👗 Roupas", callback_data: "cat:expense:Roupas" },
      ],
      [
        { text: "📺 Streaming", callback_data: "cat:expense:Streaming" },
        { text: "📦 Outros", callback_data: "cat:expense:Outros" },
      ],
    ],
  };
}

// ── Seleção de categoria de receita ──────────────────────────────────────

export function incomeCategoryKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "💼 Salário", callback_data: "cat:income:Salário" },
        { text: "💻 Freelance", callback_data: "cat:income:Freelance" },
      ],
      [
        { text: "📈 Investimentos", callback_data: "cat:income:Investimentos" },
        { text: "📦 Outros", callback_data: "cat:income:Outros" },
      ],
    ],
  };
}

// ── Paginação ─────────────────────────────────────────────────────────────

export function paginationKeyboard(
  current: number,
  total: number
): InlineKeyboardMarkup {
  const nav = [];
  if (current > 1) nav.push({ text: "⬅️ Anterior", callback_data: `latest:page:${current - 1}` });
  if (current < total) nav.push({ text: "Próxima ➡️", callback_data: `latest:page:${current + 1}` });

  const rows = [];
  if (nav.length > 0) rows.push(nav);
  rows.push([{ text: "📊 Ver resumo", callback_data: "sum:show" }]);

  return { inline_keyboard: rows };
}

// ── Menu de configurações ─────────────────────────────────────────────────

export function configMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "🔔 Resumo diário", callback_data: "cfg:daily" }],
      [{ text: "🎯 Metas mensais", callback_data: "cfg:goals" }],
      [{ text: "🏷 Categorias", callback_data: "cfg:categories" }],
      [{ text: "❌ Fechar", callback_data: "cfg:close" }],
    ],
  };
}

// ── Teclado vazio (remove botões de uma mensagem editada) ─────────────────

export const emptyKeyboard: InlineKeyboardMarkup = { inline_keyboard: [] };
