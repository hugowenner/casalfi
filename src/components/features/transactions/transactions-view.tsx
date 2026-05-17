"use client";

import { useState, useTransition, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AddTransactionDialog } from "./add-transaction-dialog";
import { deleteTransactionAction } from "@/actions/transactions";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TransactionWithRelations, Category } from "@/types";

interface TransactionsViewProps {
  initialTransactions: TransactionWithRelations[];
  categories: Category[];
  userId: string;
}

export function TransactionsView({ initialTransactions, userId }: TransactionsViewProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return initialTransactions.filter((tx) => {
      const matchSearch = tx.description.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || tx.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [initialTransactions, search, typeFilter]);

  // Agrupar por data
  const grouped = useMemo(() => {
    const map = new Map<string, TransactionWithRelations[]>();
    for (const tx of filtered) {
      const key = format(tx.date, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteTransactionAction(id);
      if (result.success) {
        toast.success("Transação removida");
      } else {
        toast.error(result.error);
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="px-4 py-6 md:px-8 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Lançamentos</h1>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lançamento..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["all", "expense", "income"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                typeFilter === t
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "all" ? "Todos" : t === "expense" ? "Gastos" : "Receitas"}
            </button>
          ))}
        </div>
      </div>

      {/* Lista agrupada por data */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Nenhum lançamento</p>
          <p className="text-sm mt-1">Use o botão + para adicionar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, txs]) => {
            const dayTotal = txs.reduce((sum, tx) => {
              return tx.type === "income" ? sum + tx.amount : sum - tx.amount;
            }, 0);

            return (
              <div key={date}>
                {/* Header da data */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    {formatDate(date)}
                  </p>
                  <p className={cn(
                    "text-xs font-semibold",
                    dayTotal >= 0 ? "text-income" : "text-expense"
                  )}>
                    {dayTotal >= 0 ? "+" : ""}{formatCurrency(dayTotal)}
                  </p>
                </div>

                {/* Transações do dia */}
                <div className="space-y-1">
                  <AnimatePresence>
                    {txs.map((tx) => (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-border transition-all group"
                      >
                        {/* Tipo */}
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          tx.type === "income" ? "bg-income/15" : "bg-expense/15"
                        )}>
                          {tx.type === "income"
                            ? <TrendingUp className="h-3.5 w-3.5 text-income" />
                            : <TrendingDown className="h-3.5 w-3.5 text-expense" />
                          }
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tx.description}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {tx.category && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                {tx.category.name}
                              </Badge>
                            )}
                            {tx.account && (
                              <span className="text-[10px] text-muted-foreground">{tx.account.name}</span>
                            )}
                          </div>
                        </div>

                        {/* Valor */}
                        <p className={cn(
                          "text-sm font-bold tabular-nums shrink-0",
                          tx.type === "income" ? "text-income" : "text-expense"
                        )}>
                          {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                        </p>

                        {/* Ação — sempre visível no mobile, aparece no hover em desktop */}
                        {tx.userId === userId && (
                          <button
                            onClick={() => handleDelete(tx.id)}
                            disabled={isPending && deletingId === tx.id}
                            className="md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB mobile */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-20 right-4 md:hidden z-30 w-14 h-14 rounded-2xl gradient-primary shadow-lg shadow-purple-950/40 flex items-center justify-center text-white"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AddTransactionDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
