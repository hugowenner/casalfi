// Orquestrador da integração Telegram — UX Premium.
//
// Fluxos suportados:
//   1. Texto livre → IA parseia → cria transação
//   2. Botão menu (💸/💰) → inline categorias → usuário digita valor → cria sem IA
//   3. /desfazer → confirmação → exclusão
//   4. /resumo, /ultimas (paginada), /config
//   5. callback_query → callback router centralizado

import { db } from "@/lib/db";
import {
  sendTelegramMessage,
  sendWithKeyboard,
  sendWithPersistentMenu,
  editMessageText,
  answerCallbackQuery,
} from "@/services/telegram.service";
import { parseTransactionFromText } from "@/services/ai-transaction-parser.service";
import { createTransaction, deleteTransaction, updateTransactionAmount } from "@/services/transaction.service";
import {
  afterExpenseKeyboard,
  afterIncomeKeyboard,
  confirmDeleteKeyboard,
  cancelFlowKeyboard,
  expenseCategoryKeyboard,
  incomeCategoryKeyboard,
  configMenuKeyboard,
  txListKeyboard,
  confirmTxDeleteKeyboard,
  emptyKeyboard,
} from "@/services/telegram-keyboards";
import { mainMenu, MENU_BUTTONS } from "@/services/telegram-menus";
import {
  getState,
  setState,
  clearState,
  ConversationState,
} from "@/services/telegram-state.service";
import { formatCurrency } from "@/lib/format";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

// Escapa chars especiais do Markdown v1 do Telegram (_  *  `  [)
function escapeMd(s: string): string {
  return s.replace(/[_*`[]/g, "\\$&");
}

// Normaliza texto de botão (remove variation selectors U+FE0F) para comparação segura
function norm(s: string): string {
  return s.replace(/️/g, "").trim();
}
import { ptBR } from "date-fns/locale";
import type { TelegramUpdate } from "@/types/telegram";
import type { TransactionInput } from "@/validators/transaction";

// ── Constantes ────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

// Descrições padrão por categoria (fluxo de botões — sem chamar IA)
const CATEGORY_DEFAULT_DESCRIPTION: Record<string, string> = {
  "Alimentação": "Refeição",
  "Supermercado": "Compras no mercado",
  "Transporte": "Transporte",
  "Moradia": "Despesa de moradia",
  "Saúde": "Saúde",
  "Educação": "Educação",
  "Lazer": "Lazer",
  "Roupas": "Compra de roupas",
  "Streaming": "Streaming",
  "Outros": "Outros",
  "Salário": "Salário",
  "Freelance": "Freelance",
  "Investimentos": "Rendimento",
};

// ── handleTelegramUpdate ──────────────────────────────────────────────────

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  console.log("🧭 ENTRY POINT UPDATE:", {
    type: update.callback_query ? "callback" : "message",
    text: update.message?.text,
    callbackData: update.callback_query?.data,
  });

  if (update.callback_query) {
    await callbackRouter(update.callback_query);
    return;
  }

  const msg = update.message;
  if (!msg?.text || !msg.from) return;
  if (msg.from.is_bot) return;

  if (msg.chat.type !== "private") {
    await sendTelegramMessage(msg.chat.id, "⚠️ Por segurança, só respondo em conversas privadas.");
    return;
  }

  const chatId = msg.chat.id;
  const telegramUserId = msg.from.id;
  const text = msg.text.trim();

  // ── Comandos ───────────────────────────────────────────────────────────

  if (text.startsWith("/start")) { await handleStart(chatId); return; }
  if (text.startsWith("/ajuda") || text.startsWith("/help")) { await handleHelp(chatId); return; }
  if (text.startsWith("/config")) { await handleConfig(chatId); return; }
  if (text.startsWith("/resumo")) { await handleResumo(chatId, telegramUserId); return; }
  if (text.startsWith("/ultimas")) { await handleGerenciar(chatId, telegramUserId, 1); return; }
  if (text.startsWith("/gerenciar")) { await handleGerenciar(chatId, telegramUserId, 1); return; }
  if (text.startsWith("/vincular")) {
    const token = text.split(" ")[1]?.toUpperCase();
    await handleVincular(chatId, telegramUserId, token);
    return;
  }
  if (text.startsWith("/desfazer") || isDeleteIntent(text)) {
    await handleDesfazer(chatId, telegramUserId);
    return;
  }
  if (text === "/cancelar" || text === "cancelar") {
    await handleCancelar(chatId, telegramUserId);
    return;
  }

  // ── Botões do menu persistente ────────────────────────────────────────
  // norm() remove variation selectors (U+FE0F) que alguns clientes Telegram inserem nos emojis

  const normText = norm(text);
  if (normText === norm(MENU_BUTTONS.EXPENSE)) { await handleAddExpense(chatId, telegramUserId); return; }
  if (normText === norm(MENU_BUTTONS.INCOME)) { await handleAddIncome(chatId, telegramUserId); return; }
  if (normText === norm(MENU_BUTTONS.SUMMARY)) { await handleResumo(chatId, telegramUserId); return; }
  if (normText === norm(MENU_BUTTONS.LATEST)) { await handleGerenciar(chatId, telegramUserId, 1); return; }
  if (normText === norm(MENU_BUTTONS.CONFIG)) { await handleConfig(chatId); return; }
  if (normText === norm(MENU_BUTTONS.HELP)) { await handleHelp(chatId); return; }

  // ── Verificar estado da conversa ──────────────────────────────────────
  // Se o usuário selecionou uma categoria e está aguardando o valor,
  // interceptamos a mensagem antes de chamar a IA.

  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true, name: true, coupleId: true },
  });

  if (user) {
    const state = await getState(user.id);
    if (state?.state === ConversationState.WAITING_AMOUNT) {
      await handleAmountFromState(chatId, user, text, state.category!, state.transactionType!);
      return;
    }
    if (state?.state === ConversationState.WAITING_EDIT_AMOUNT) {
      await handleEditAmountFromState(chatId, user.id, text, state.txId!);
      return;
    }
  }

  // ── Texto livre → IA ──────────────────────────────────────────────────
  await handleTransactionMessage(chatId, telegramUserId, text);
}

// ── Callback router centralizado ─────────────────────────────────────────
//
// Namespace  │ Ação              │ Exemplo
// ───────────┼───────────────────┼────────────────────────────────
// undo       │ undo:confirm:id   │ mostra confirmação de exclusão
//            │ undo:do:id        │ executa exclusão
//            │ undo:cancel       │ cancela
// cat        │ cat:expense:Nome  │ categoria de despesa selecionada
//            │ cat:income:Nome   │ categoria de receita selecionada
// latest     │ latest:page:N     │ navega para página N
// sum        │ sum:show          │ exibe resumo
// add        │ add:expense       │ inicia fluxo de despesa
//            │ add:income        │ inicia fluxo de receita
// cfg        │ cfg:menu          │ abre config
//            │ cfg:close         │ fecha config
//            │ cfg:daily|goals   │ placeholder — em breve

async function callbackRouter(
  cq: NonNullable<TelegramUpdate["callback_query"]>
): Promise<void> {
  const data = cq.data ?? "";
  const chatId = cq.message?.chat.id;
  const messageId = cq.message?.message_id;
  const telegramUserId = cq.from.id;

  console.log("🎯 CALLBACK RECEBIDO:", {
    data,
    id: cq.id,
    chatId,
    messageId,
    telegramUserId,
  });

  // Sempre responde ao callback para remover o loading no botão
  // O texto aparece como toast de ~2s no celular
  const [ns, action, param] = data.split(":");

  if (!chatId) {
    await answerCallbackQuery(cq.id);
    return;
  }

  // ── namespace: undo ────────────────────────────────────────────────────
  if (ns === "undo") {
    if (action === "confirm") {
      await answerCallbackQuery(cq.id);
      await handleUndoConfirm(chatId, messageId, telegramUserId, param);
    } else if (action === "do") {
      await handleUndoDo(chatId, messageId, telegramUserId, param, cq.id);
    } else if (action === "cancel") {
      await answerCallbackQuery(cq.id, "✋ Operação cancelada");
      if (messageId) {
        await editMessageText(chatId, messageId, `✋ *Operação cancelada.*\n\nA transação foi mantida.`, emptyKeyboard);
      }
      // Limpa apenas estado WAITING_AMOUNT (não apaga WAITING_EDIT_AMOUNT de outro fluxo)
      const user = await db.user.findUnique({ where: { telegramId: String(telegramUserId) }, select: { id: true } });
      if (user) {
        const st = await getState(user.id);
        if (st?.state === ConversationState.WAITING_AMOUNT) await clearState(user.id);
      }
    }
    return;
  }

  // ── namespace: cat (categoria selecionada via botão) ───────────────────
  if (ns === "cat") {
    const type = action as "expense" | "income";
    const category = param;

    const user = await db.user.findUnique({
      where: { telegramId: String(telegramUserId) },
      select: { id: true },
    });

    if (!user) {
      await answerCallbackQuery(cq.id, "🔗 Vincule sua conta primeiro");
      return;
    }

    const emoji = type === "expense" ? "💸" : "💰";
    const emojiCat = categoryEmoji(category);

    await answerCallbackQuery(cq.id, `${emojiCat} ${category} selecionada`);
    await setState(user.id, ConversationState.WAITING_AMOUNT, { category, transactionType: type });

    const prompt =
      `${emoji} *${category}*\n\n` +
      `Qual o valor? Pode enviar apenas o número.\n\n` +
      `Exemplos: \`45\`  \`45,50\`  \`R$ 120\``;

    if (messageId) {
      await editMessageText(chatId, messageId, prompt, cancelFlowKeyboard());
    } else {
      await sendWithKeyboard(chatId, prompt, cancelFlowKeyboard());
    }
    return;
  }

  // ── namespace: latest (paginação — redireciona para gerenciar com botões) ─
  if (ns === "latest") {
    await answerCallbackQuery(cq.id);
    const page = parseInt(param ?? "1", 10) || 1;
    const user = await db.user.findUnique({
      where: { telegramId: String(telegramUserId) },
      select: { id: true, coupleId: true },
    });
    if (!user) return;
    // Usa sendGerenciarPage para que botões ✏️/🗑 sempre apareçam,
    // mesmo em mensagens antigas que usavam latest:page:N
    await sendGerenciarPage(chatId, user.id, user.coupleId, page, messageId);
    return;
  }

  // ── namespace: sum (resumo) ────────────────────────────────────────────
  if (ns === "sum") {
    await answerCallbackQuery(cq.id, "📊 Carregando resumo...");
    await handleResumo(chatId, telegramUserId);
    return;
  }

  // ── namespace: add (iniciar fluxo pelo botão) ─────────────────────────
  if (ns === "add") {
    await answerCallbackQuery(cq.id);
    if (action === "expense") await handleAddExpense(chatId, telegramUserId);
    else if (action === "income") await handleAddIncome(chatId, telegramUserId);
    return;
  }

  // ── namespace: cfg (configurações) ────────────────────────────────────
  if (ns === "cfg") {
    if (action === "close") {
      await answerCallbackQuery(cq.id, "✅ Fechado");
      if (messageId) await editMessageText(chatId, messageId, `⚙️ _Configurações fechadas._`, emptyKeyboard);
    } else if (action === "daily" || action === "goals" || action === "categories") {
      await answerCallbackQuery(cq.id, "🚧 Em breve!");
      if (messageId) {
        await editMessageText(
          chatId, messageId,
          `⚙️ *Configurações*\n\n🚧 Esta funcionalidade será lançada em breve.\n\nFique de olho nas atualizações!`,
          configMenuKeyboard()
        );
      }
    } else if (action === "menu") {
      await answerCallbackQuery(cq.id);
      await handleConfig(chatId);
    } else {
      await answerCallbackQuery(cq.id);
    }
    return;
  }

  // ── namespace: tx (gerenciar transações) ─────────────────────────────────
  if (ns === "tx") {
    const user = await db.user.findUnique({
      where: { telegramId: String(telegramUserId) },
      select: { id: true, coupleId: true },
    });

    if (!user) {
      await answerCallbackQuery(cq.id, "🔗 Vincule sua conta primeiro");
      return;
    }

    if (action === "page") {
      await answerCallbackQuery(cq.id);
      const page = parseInt(param ?? "1", 10) || 1;
      await sendGerenciarPage(chatId, user.id, user.coupleId, page, messageId);
      return;
    }

    if (action === "edit") {
      const tx = await db.transaction.findFirst({
        where: {
          id: param,
          OR: [
            { userId: user.id },
            ...(user.coupleId ? [{ coupleId: user.coupleId }] : []),
          ],
        },
        select: { id: true, userId: true, description: true, amount: true, type: true, category: { select: { name: true } } },
      });
      if (!tx) {
        await answerCallbackQuery(cq.id, "❌ Transação não encontrada");
        return;
      }
      await answerCallbackQuery(cq.id);
      await setState(user.id, ConversationState.WAITING_EDIT_AMOUNT, { txId: tx.id });
      const emoji = tx.type === "expense" ? "💸" : "💰";
      const catName = tx.category?.name ?? "";
      const prompt =
        `✏️ *Editar valor*\n\n` +
        `${emoji} ${formatCurrency(tx.amount)}${catName ? ` — ${escapeMd(catName)}` : ""}\n` +
        `📝 ${escapeMd(tx.description)}\n\n` +
        `Qual o novo valor?`;
      if (messageId) {
        await editMessageText(chatId, messageId, prompt, cancelFlowKeyboard());
      } else {
        await sendWithKeyboard(chatId, prompt, cancelFlowKeyboard());
      }
      return;
    }

    if (action === "delete") {
      // Busca a transação verificando: própria OU do casal
      const tx = await db.transaction.findFirst({
        where: {
          id: param,
          OR: [
            { userId: user.id },
            ...(user.coupleId ? [{ coupleId: user.coupleId }] : []),
          ],
        },
        select: { id: true, userId: true, description: true, amount: true, type: true },
      });
      if (!tx) {
        await answerCallbackQuery(cq.id, "❌ Transação não encontrada");
        return;
      }
      await answerCallbackQuery(cq.id);
      const emoji = tx.type === "expense" ? "💸" : "💰";
      const isPartner = tx.userId !== user.id;
      const confirmText =
        `⚠️ *Confirmar exclusão?*\n\n` +
        `${emoji} ${formatCurrency(tx.amount)} — ${escapeMd(tx.description)}` +
        (isPartner ? `\n\n_Transação do seu parceiro_` : "");
      if (messageId) {
        await editMessageText(chatId, messageId, confirmText, confirmTxDeleteKeyboard(tx.id));
      } else {
        await sendWithKeyboard(chatId, confirmText, confirmTxDeleteKeyboard(tx.id));
      }
      return;
    }

    if (action === "confirmdelete") {
      // Busca a transação verificando: própria OU do casal
      const tx = await db.transaction.findFirst({
        where: {
          id: param,
          OR: [
            { userId: user.id },
            ...(user.coupleId ? [{ coupleId: user.coupleId }] : []),
          ],
        },
        select: { id: true, userId: true, description: true, amount: true, type: true },
      });
      if (!tx) {
        await answerCallbackQuery(cq.id, "❌ Não encontrada");
        if (messageId) await editMessageText(chatId, messageId, `❌ Transação não encontrada.`, emptyKeyboard);
        return;
      }
      try {
        // Passa o userId real da transação — deleteTransaction valida por userId
        await deleteTransaction(tx.id, tx.userId);
        const emoji = tx.type === "expense" ? "💸" : "💰";
        await answerCallbackQuery(cq.id, "✅ Excluída!");
        const doneText = `✅ *Transação excluída!*\n\n${emoji} ${formatCurrency(tx.amount)} — ${escapeMd(tx.description)}`;
        if (messageId) {
          // Mostra confirmação e depois atualiza a lista na mesma mensagem
          await editMessageText(chatId, messageId, doneText, emptyKeyboard);
        } else {
          await sendTelegramMessage(chatId, doneText);
        }
        // Envia a lista gerenciável atualizada como nova mensagem
        await sendGerenciarPage(chatId, user.id, user.coupleId, 1);
      } catch {
        await answerCallbackQuery(cq.id, "❌ Erro ao excluir");
        if (messageId) await editMessageText(chatId, messageId, `❌ Não foi possível excluir.`, emptyKeyboard);
      }
      return;
    }

    if (action === "canceldelete") {
      await answerCallbackQuery(cq.id, "✋ Cancelado");
      // Volta para a lista gerenciável
      await sendGerenciarPage(chatId, user.id, user.coupleId, 1, messageId);
      return;
    }

    await answerCallbackQuery(cq.id);
    return;
  }

  // Fallback para callbacks antigos (compatibilidade com mensagens já enviadas)
  if (data.startsWith("undo_confirm:")) {
    await answerCallbackQuery(cq.id);
    await handleUndoConfirm(chatId, messageId, telegramUserId, data.split(":")[1]);
    return;
  }
  if (data.startsWith("do_delete:")) {
    await handleUndoDo(chatId, messageId, telegramUserId, data.split(":")[1], cq.id);
    return;
  }
  if (data === "cancel_delete") {
    await answerCallbackQuery(cq.id, "✋ Cancelado");
    if (messageId) await editMessageText(chatId, messageId, `✋ *Operação cancelada.*`, emptyKeyboard);
    return;
  }
  if (data === "show_summary") {
    await answerCallbackQuery(cq.id, "📊 Carregando...");
    await handleResumo(chatId, telegramUserId);
    return;
  }

  await answerCallbackQuery(cq.id);
}

// ── Fluxo: iniciar despesa ────────────────────────────────────────────────

async function handleAddExpense(chatId: number, telegramUserId: number): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true },
  });

  if (!user) {
    await sendTelegramMessage(chatId, `🔗 Vincule sua conta primeiro.\n\nEnvie \`/start\` para ver como.`);
    return;
  }

  await sendWithKeyboard(
    chatId,
    `💸 *Registrar gasto*\n\nEscolha a categoria:`,
    expenseCategoryKeyboard()
  );
}

// ── Fluxo: iniciar receita ────────────────────────────────────────────────

async function handleAddIncome(chatId: number, telegramUserId: number): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true },
  });

  if (!user) {
    await sendTelegramMessage(chatId, `🔗 Vincule sua conta primeiro.\n\nEnvie \`/start\` para ver como.`);
    return;
  }

  await sendWithKeyboard(
    chatId,
    `💰 *Registrar receita*\n\nEscolha a categoria:`,
    incomeCategoryKeyboard()
  );
}

// ── Fluxo: valor digitado após categoria (sem IA) ─────────────────────────

async function handleAmountFromState(
  chatId: number,
  user: { id: string; name: string; coupleId: string | null },
  text: string,
  category: string,
  type: "income" | "expense"
): Promise<void> {
  const amount = parseAmount(text);

  if (!amount) {
    await sendWithKeyboard(
      chatId,
      `❌ Não entendi o valor. Tente: \`45\` ou \`45,50\``,
      cancelFlowKeyboard()
    );
    return;
  }

  await clearState(user.id);

  const description = CATEGORY_DEFAULT_DESCRIPTION[category] ?? category;
  const categoryId = await resolveCategoryId(category, user.coupleId, type);
  const today = format(new Date(), "yyyy-MM-dd");

  const input: TransactionInput = {
    description,
    amount,
    type,
    date: today,
    categoryId: categoryId ?? undefined,
    splitType: "individual",
    paidByUserId: user.id,
    isRecurring: false,
  };

  let createdId: string | undefined;
  try {
    const tx = await createTransaction(user.id, user.coupleId, input, {
      source: "telegram",
      rawInput: text,
      aiCategory: category,
      aiConfidence: 1.0,
    });
    createdId = tx.id;
  } catch (err) {
    console.error("[Telegram] Erro ao criar transação:", err);
    await sendTelegramMessage(chatId, `❌ Erro ao registrar. Tente novamente.`);
    return;
  }

  const emoji = type === "expense" ? "💸" : "💰";
  const label = type === "expense" ? "Despesa" : "Receita";
  const successText =
    `${emoji} *${label} cadastrada!*\n\n` +
    `💵 ${formatCurrency(amount)}\n` +
    `🏷 ${category}\n` +
    `📝 ${description}`;

  const keyboard = createdId
    ? (type === "expense" ? afterExpenseKeyboard(createdId) : afterIncomeKeyboard(createdId))
    : emptyKeyboard;

  await sendWithKeyboard(chatId, successText, keyboard);
}

// ── Cancelar fluxo em andamento ───────────────────────────────────────────

async function handleCancelar(chatId: number, telegramUserId: number): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true },
  });
  if (user) await clearState(user.id);
  await sendTelegramMessage(chatId, `✋ Operação cancelada.`);
}

// ── Fluxo: valor digitado para edição de transação ───────────────────────

async function handleEditAmountFromState(
  chatId: number,
  userId: string,
  text: string,
  txId: string
): Promise<void> {
  const amount = parseAmount(text);

  if (!amount) {
    await sendWithKeyboard(
      chatId,
      `❌ Não entendi o valor. Tente: \`45\` ou \`45,50\``,
      cancelFlowKeyboard()
    );
    return;
  }

  await clearState(userId);

  // Busca a transação sem restringir por userId — o acesso já foi validado
  // ao salvar o estado (tx:edit verifica coupleId). Passa userId real do dono
  // para o service (que valida internamente por userId).
  const tx = await db.transaction.findUnique({
    where: { id: txId },
    select: { id: true, userId: true, description: true, amount: true, type: true, category: { select: { name: true } } },
  });

  if (!tx) {
    await sendTelegramMessage(chatId, `❌ Transação não encontrada. Pode ter sido excluída.`);
    return;
  }

  try {
    await updateTransactionAmount(txId, tx.userId, amount);
    const emoji = tx.type === "expense" ? "💸" : "💰";
    const catName = tx.category?.name ?? "";
    await sendWithKeyboard(
      chatId,
      `✅ *Valor atualizado!*\n\n` +
      `${emoji} ${formatCurrency(tx.amount)} → *${formatCurrency(amount)}*\n` +
      `📝 ${escapeMd(tx.description)}${catName ? `\n🏷 ${escapeMd(catName)}` : ""}`,
      afterExpenseKeyboard(txId)
    );
  } catch (err) {
    console.error("[Telegram] Erro ao atualizar transação:", err);
    await sendTelegramMessage(chatId, `❌ Não foi possível atualizar. Tente novamente.`);
  }
}

// ── Gerenciar transações ──────────────────────────────────────────────────

async function handleGerenciar(chatId: number, telegramUserId: number, page: number): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true, coupleId: true },
  });

  if (!user) {
    await sendTelegramMessage(chatId, `🔗 Você ainda não vinculou sua conta.`);
    return;
  }

  await sendGerenciarPage(chatId, user.id, user.coupleId, page);
}

async function sendGerenciarPage(
  chatId: number,
  userId: string,
  coupleId: string | null,
  page: number,
  editMessageId?: number
): Promise<void> {
  const where = {
    OR: [{ userId }, ...(coupleId ? [{ coupleId }] : [])],
  };

  const [total, transactions] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        date: true,
        userId: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  if (transactions.length === 0) {
    const msg = `📭 Nenhuma transação encontrada.`;
    if (editMessageId) {
      await editMessageText(chatId, editMessageId, msg, emptyKeyboard);
    } else {
      await sendTelegramMessage(chatId, msg);
    }
    return;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const lines = transactions.map((t, i) => {
    const emoji = t.type === "expense" ? "💸" : "💰";
    const dateStr = format(t.date, "dd/MM");
    const cat = t.category?.name ? ` _${escapeMd(t.category.name)}_` : "";
    const mine = t.userId === userId ? "" : " 👫";
    return `${i + 1}. ${emoji} ${dateStr} *${formatCurrency(t.amount)}*${cat} — ${escapeMd(t.description)}${mine}`;
  });

  const header = totalPages > 1
    ? `📋 *Gerenciar transações* (pág. ${page}/${totalPages}):\n\n`
    : `📋 *Gerenciar transações:*\n\n`;

  const footer = `\n\n_✏️ = editar valor  🗑 = excluir_`;
  const text = header + lines.join("\n") + footer;
  const txIds = transactions.map((t) => t.id);
  const keyboard = txListKeyboard(txIds, page, totalPages);

  if (editMessageId) {
    await editMessageText(chatId, editMessageId, text, keyboard);
  } else {
    await sendWithKeyboard(chatId, text, keyboard);
  }
}

// ── handleUndoConfirm ─────────────────────────────────────────────────────

async function handleUndoConfirm(
  chatId: number,
  messageId: number | undefined,
  telegramUserId: number,
  txId: string
): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true },
  });
  if (!user) return;

  const tx = await db.transaction.findFirst({
    where: { id: txId, userId: user.id },
    select: { id: true, description: true, amount: true, type: true },
  });

  if (!tx) {
    await sendTelegramMessage(chatId, `❌ Transação não encontrada ou já removida.`);
    return;
  }

  const emoji = tx.type === "expense" ? "💸" : "💰";
  const confirmText =
    `⚠️ *Deseja remover esta transação?*\n\n` +
    `${emoji} ${formatCurrency(tx.amount)} — ${escapeMd(tx.description)}`;

  if (messageId) {
    await editMessageText(chatId, messageId, confirmText, confirmDeleteKeyboard(tx.id));
  } else {
    await sendWithKeyboard(chatId, confirmText, confirmDeleteKeyboard(tx.id));
  }
}

// ── handleUndoDo ─────────────────────────────────────────────────────────

async function handleUndoDo(
  chatId: number,
  messageId: number | undefined,
  telegramUserId: number,
  txId: string,
  callbackQueryId: string
): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true },
  });
  if (!user) { await answerCallbackQuery(callbackQueryId); return; }

  const tx = await db.transaction.findFirst({
    where: { id: txId, userId: user.id },
    select: { id: true, description: true, amount: true, type: true },
  });

  if (!tx) {
    await answerCallbackQuery(callbackQueryId, "❌ Não encontrada");
    if (messageId) await editMessageText(chatId, messageId, `❌ Transação não encontrada ou já removida.`, emptyKeyboard);
    return;
  }

  try {
    await deleteTransaction(tx.id, user.id);
    const emoji = tx.type === "expense" ? "💸" : "💰";
    await answerCallbackQuery(callbackQueryId, "✅ Transação removida!");
    const doneText = `✅ *Transação removida!*\n\n${emoji} ${formatCurrency(tx.amount)} — ${escapeMd(tx.description)}`;
    if (messageId) {
      await editMessageText(chatId, messageId, doneText, emptyKeyboard);
    } else {
      await sendTelegramMessage(chatId, doneText);
    }
  } catch {
    await answerCallbackQuery(callbackQueryId, "❌ Erro ao remover");
    const errText = `❌ Não foi possível remover a transação.`;
    if (messageId) await editMessageText(chatId, messageId, errText, emptyKeyboard);
  }
}

// ── handleStart — Onboarding premium ────────────────────────────────────

async function handleStart(chatId: number): Promise<void> {
  const welcomeText =
    `👋 *Bem-vindo ao CASALFI!*\n\n` +
    `Registro automático de gastos e receitas para casais.\n\n` +
    `*O que você pode fazer:*\n` +
    `💸 Registrar gastos por categoria\n` +
    `💰 Registrar receitas\n` +
    `📊 Ver resumo mensal instantâneo\n` +
    `📅 Acompanhar histórico\n` +
    `↩️ Desfazer qualquer transação\n\n` +
    `*Para começar:*\n` +
    `1. Abra o app CASALFI → Configurações\n` +
    `2. Clique em "Gerar código Telegram"\n` +
    `3. Envie aqui: \`/vincular SEU_CODIGO\`\n\n` +
    `*Após vincular, registre gastos de dois jeitos:*\n` +
    `• Toque em *💸 Gasto* no menu abaixo\n` +
    `• Ou escreva: _"gastei 80 no mercado"_`;

  await sendWithPersistentMenu(chatId, welcomeText, mainMenu());
}

// ── handleHelp ────────────────────────────────────────────────────────────

async function handleHelp(chatId: number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `*Comandos disponíveis:*\n\n` +
    `/vincular CODIGO — vincula sua conta\n` +
    `/resumo — resumo de gastos do mês\n` +
    `/ultimas — últimas transações\n` +
    `/gerenciar — editar ou excluir transações\n` +
    `/desfazer — remove a última transação\n` +
    `/config — configurações\n` +
    `/ajuda — exibe esta mensagem\n\n` +
    `*Ou use o menu abaixo da tela* 👇\n\n` +
    `*Exemplos de texto livre:*\n` +
    `• _gastei 80 no mercado_\n` +
    `• _uber 25 reais_\n` +
    `• _pizza 70 dividido_ _(divide 50/50)_\n` +
    `• _recebi 3000 de salário_`
  );
}

// ── handleConfig ──────────────────────────────────────────────────────────

async function handleConfig(chatId: number): Promise<void> {
  await sendWithKeyboard(
    chatId,
    `⚙️ *Configurações*\n\nEscolha uma opção:`,
    configMenuKeyboard()
  );
}

// ── handleVincular ────────────────────────────────────────────────────────

async function handleVincular(
  chatId: number,
  telegramUserId: number,
  token: string | undefined
): Promise<void> {
  if (!token) {
    await sendTelegramMessage(chatId, `❌ Informe o código gerado no app.\n\nEx: \`/vincular ABC123\``);
    return;
  }

  const user = await db.user.findUnique({
    where: { telegramLinkToken: token },
    select: { id: true, name: true, telegramLinkAt: true },
  });

  if (!user) {
    await sendTelegramMessage(chatId, `❌ Código inválido ou expirado.\n\nGere um novo no app CASALFI.`);
    return;
  }

  const isExpired = !user.telegramLinkAt || Date.now() - user.telegramLinkAt.getTime() > 10 * 60 * 1000;

  if (isExpired) {
    await db.user.update({ where: { id: user.id }, data: { telegramLinkToken: null, telegramLinkAt: null } });
    await sendTelegramMessage(chatId, `⏰ Código expirado. Gere um novo no app CASALFI.`);
    return;
  }

  const existing = await db.user.findUnique({ where: { telegramId: String(telegramUserId) }, select: { id: true } });
  if (existing && existing.id !== user.id) {
    await sendTelegramMessage(chatId, `⚠️ Este Telegram já está vinculado a outra conta CASALFI.`);
    return;
  }

  await db.user.update({
    where: { id: user.id },
    data: { telegramId: String(telegramUserId), telegramLinkToken: null, telegramLinkAt: null },
  });

  const firstName = user.name.split(" ")[0];
  const successText =
    `✅ *Conta vinculada, ${firstName}!*\n\n` +
    `Agora registre seus gastos pelo menu abaixo 👇\n\n` +
    `Ou escreva diretamente: _"gastei 80 no mercado"_`;

  await sendWithPersistentMenu(chatId, successText, mainMenu());
}

// ── handleResumo ──────────────────────────────────────────────────────────

async function handleResumo(chatId: number, telegramUserId: number): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true, coupleId: true },
  });

  if (!user) {
    await sendTelegramMessage(chatId, `🔗 Você ainda não vinculou sua conta.`);
    return;
  }

  const now = new Date();
  const month = format(now, "yyyy-MM");
  const start = startOfMonth(parseISO(`${month}-01`));
  const end = endOfMonth(parseISO(`${month}-01`));

  const transactions = await db.transaction.findMany({
    where: {
      OR: [{ userId: user.id }, ...(user.coupleId ? [{ coupleId: user.coupleId }] : [])],
      date: { gte: start, lte: end },
    },
    select: { type: true, amount: true, category: { select: { name: true } } },
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const catMap = new Map<string, number>();

  for (const t of transactions) {
    if (t.type === "income") totalIncome += t.amount;
    if (t.type === "expense") {
      totalExpense += t.amount;
      const cat = t.category?.name ?? "Outros";
      catMap.set(cat, (catMap.get(cat) ?? 0) + t.amount);
    }
  }

  const balance = totalIncome - totalExpense;
  const monthLabel = format(now, "MMMM 'de' yyyy", { locale: ptBR });
  const balanceSign = balance >= 0 ? "+" : "";

  const topCats = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, val]) => `  ${categoryEmoji(name)} ${name}: *${formatCurrency(val)}*`)
    .join("\n");

  const savingsLine = totalIncome > 0
    ? `\n💡 Taxa de poupança: *${Math.round(((totalIncome - totalExpense) / totalIncome) * 100)}%*`
    : "";

  await sendTelegramMessage(
    chatId,
    `📊 *Resumo — ${monthLabel}*\n\n` +
    `💰 Receitas: *${formatCurrency(totalIncome)}*\n` +
    `💸 Despesas: *${formatCurrency(totalExpense)}*\n` +
    `📈 Saldo: *${balanceSign}${formatCurrency(balance)}*` +
    savingsLine +
    (topCats ? `\n\n*Top categorias:*\n${topCats}` : "") +
    `\n\n_Abra o app para ver o gráfico completo._`
  );
}

// sendUltimasPage foi removido — toda paginação usa sendGerenciarPage (com botões ✏️/🗑)

// ── handleDesfazer ────────────────────────────────────────────────────────

async function handleDesfazer(chatId: number, telegramUserId: number): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true },
  });

  if (!user) {
    await sendTelegramMessage(chatId, `🔗 Você ainda não vinculou sua conta.`);
    return;
  }

  const last = await db.transaction.findFirst({
    where: { userId: user.id, source: "telegram" },
    orderBy: { createdAt: "desc" },
    select: { id: true, description: true, amount: true, type: true },
  });

  if (!last) {
    await sendTelegramMessage(chatId, `❌ Nenhuma transação recente para desfazer.`);
    return;
  }

  const emoji = last.type === "expense" ? "💸" : "💰";
  await sendWithKeyboard(
    chatId,
    `⚠️ *Deseja remover esta transação?*\n\n${emoji} ${formatCurrency(last.amount)} — ${escapeMd(last.description)}`,
    confirmDeleteKeyboard(last.id)
  );
}

// ── handleTransactionMessage (texto livre → IA) ───────────────────────────

async function handleTransactionMessage(
  chatId: number,
  telegramUserId: number,
  text: string
): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true, name: true, coupleId: true },
  });

  if (!user) {
    await sendTelegramMessage(
      chatId,
      `🔗 Você ainda não vinculou sua conta.\n\n` +
      `1. Abra o CASALFI → Configurações\n` +
      `2. Gere um código Telegram\n` +
      `3. Envie: \`/vincular SEU_CODIGO\``
    );
    return;
  }

  const parsed = await parseTransactionFromText(text);

  if (!parsed) {
    await sendWithKeyboard(
      chatId,
      `🤔 Não entendi o valor.\n\nTente:\n• _"gastei 80 no mercado"_\n• _"uber 25"_\n\nOu use o menu abaixo para escolher a categoria:`,
      expenseCategoryKeyboard()
    );
    return;
  }

  const categoryId = await resolveCategoryId(parsed.category, user.coupleId, parsed.type);
  const today = format(new Date(), "yyyy-MM-dd");

  const input: TransactionInput = {
    description: parsed.description,
    amount: parsed.amount,
    type: parsed.type,
    date: today,
    categoryId: categoryId ?? undefined,
    splitType: parsed.splitType ?? "individual",
    paidByUserId: user.id,
    isRecurring: false,
  };

  let createdId: string | undefined;
  try {
    const tx = await createTransaction(user.id, user.coupleId, input, {
      source: "telegram",
      rawInput: text,
      aiCategory: parsed.category,
      aiConfidence: parsed.confidence,
    });
    createdId = tx.id;
  } catch (err) {
    console.error("[Telegram] Erro ao criar transação:", err);
    await sendTelegramMessage(chatId, `❌ Erro ao registrar. Tente novamente.`);
    return;
  }

  const emoji = parsed.type === "expense" ? "💸" : "💰";
  const label = parsed.type === "expense" ? "Despesa" : "Receita";
  const splitInfo = parsed.splitType === "equal" ? "\n_Dividido 50/50_" : "";
  const confidenceNote = parsed.confidence < 0.7 ? "\n\n⚠️ _Confiança baixa — confira no app_" : "";

  const successText =
    `${emoji} *${label} cadastrada!*\n\n` +
    `💵 ${formatCurrency(parsed.amount)}\n` +
    `🏷 ${escapeMd(parsed.category)}\n` +
    `📝 ${escapeMd(parsed.description)}` +
    splitInfo +
    confidenceNote;

  const keyboard = createdId
    ? (parsed.type === "expense" ? afterExpenseKeyboard(createdId) : afterIncomeKeyboard(createdId))
    : emptyKeyboard;

  await sendWithKeyboard(chatId, successText, keyboard);
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function resolveCategoryId(
  categoryName: string,
  coupleId: string | null,
  type: "income" | "expense"
): Promise<string | null> {
  const category = await db.category.findFirst({
    where: {
      name: { equals: categoryName },
      type: { in: [type, "both"] },
      OR: [
        ...(coupleId ? [{ coupleId }] : []),
        { coupleId: null, userId: null },
      ],
    },
    select: { id: true },
  });
  return category?.id ?? null;
}

// Extrai valor numérico de texto — trata formatos BR e internacionais
function parseAmount(text: string): number | null {
  // Remove símbolo de moeda e a palavra "reais"
  let clean = text
    .replace(/[Rr]\$\s*/g, "")
    .replace(/\s+reais?\s*$/i, "")
    .trim();

  // Formato brasileiro com milhar: 1.500,00
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(clean)) {
    return parseFloat(clean.replace(/\./g, "").replace(",", "."));
  }

  // Decimal com vírgula: 45,50
  if (/^\d+(,\d{1,2})$/.test(clean)) {
    return parseFloat(clean.replace(",", "."));
  }

  // Decimal simples: 45 ou 45.50
  if (/^\d+(\.\d{1,2})?$/.test(clean)) {
    const n = parseFloat(clean);
    return isNaN(n) || n <= 0 ? null : n;
  }

  return null;
}

function isDeleteIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = ["remova", "remove", "apaga", "apague", "cancela", "cancele",
    "desfaz", "desfazer", "deletar", "delete", "excluir", "exclua"];
  return keywords.some((k) => lower.includes(k));
}

// Emoji por categoria — usado no resumo e nas notificações
function categoryEmoji(name: string): string {
  const map: Record<string, string> = {
    "Alimentação": "🍔", "Supermercado": "🛒", "Transporte": "🚗",
    "Moradia": "🏠", "Saúde": "💊", "Educação": "📚",
    "Lazer": "🎮", "Roupas": "👗", "Streaming": "📺",
    "Outros": "📦", "Salário": "💼", "Freelance": "💻",
    "Investimentos": "📈",
  };
  return map[name] ?? "💰";
}
