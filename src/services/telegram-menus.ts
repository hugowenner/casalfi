// ReplyKeyboardMarkup — teclado fixo que aparece no rodapé do chat.
// Diferente do InlineKeyboard: quando o usuário clica, o texto do botão
// vira a mensagem enviada (não é callback). Tratamos esses textos no router.
//
// is_persistent: true → não some ao abrir o teclado virtual
// resize_keyboard: true → reduz altura para caber mais conteúdo na tela

export interface ReplyKeyboard {
  keyboard: string[][];
  resize_keyboard: boolean;
  is_persistent: boolean;
}

// Textos dos botões — usados como constantes para o router de mensagens.
export const MENU_BUTTONS = {
  EXPENSE: "💸 Gasto",
  INCOME: "💰 Receita",
  SUMMARY: "📊 Resumo",
  LATEST: "📅 Últimas",
  CONFIG: "⚙️ Config",
  HELP: "❓ Ajuda",
} as const;

export function mainMenu(): ReplyKeyboard {
  return {
    keyboard: [
      [MENU_BUTTONS.EXPENSE, MENU_BUTTONS.INCOME],
      [MENU_BUTTONS.SUMMARY, MENU_BUTTONS.LATEST],
      [MENU_BUTTONS.CONFIG, MENU_BUTTONS.HELP],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}
