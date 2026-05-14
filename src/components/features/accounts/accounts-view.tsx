"use client";

import { motion } from "framer-motion";
import { Wallet, CreditCard, Plus, Building2, PiggyBank, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Account, Card as CardType } from "@/types";

const ACCOUNT_ICONS: Record<string, React.ReactNode> = {
  checking:   <Building2 className="h-5 w-5" />,
  savings:    <PiggyBank className="h-5 w-5" />,
  wallet:     <Wallet className="h-5 w-5" />,
  investment: <TrendingUp className="h-5 w-5" />,
};

interface AccountsViewProps {
  accounts: Account[];
  cards: CardType[];
}

export function AccountsView({ accounts, cards }: AccountsViewProps) {
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="px-4 py-6 md:px-8 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Contas & Cartões</h1>
        <Button size="sm" variant="outline" className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      {/* Saldo total */}
      <Card className="gradient-balance border-border/30">
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground font-medium mb-1">Saldo Total</p>
          <p className="text-3xl font-bold">{formatCurrency(totalBalance)}</p>
          <p className="text-xs text-muted-foreground mt-1">{accounts.length} conta{accounts.length !== 1 ? "s" : ""}</p>
        </CardContent>
      </Card>

      {/* Contas */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contas bancárias</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conta cadastrada</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account, i) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="border-border/50 hover:border-border transition-colors">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${account.color ?? "#6b7280"}20`, color: account.color ?? "#6b7280" }}
                    >
                      {ACCOUNT_ICONS[account.type] ?? <Wallet className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{account.name}</p>
                        {account.isDefault && <Badge variant="default" className="text-[10px] h-4 px-1.5">Padrão</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
                    </div>
                    <p className={cn(
                      "font-bold text-base tabular-nums",
                      account.balance >= 0 ? "text-foreground" : "text-expense"
                    )}>
                      {formatCurrency(account.balance)}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Cartões */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Cartões de crédito</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum cartão cadastrado</p>
        ) : (
          <div className="space-y-2">
            {cards.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="border-border/50 hover:border-border transition-colors">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${card.color ?? "#8b5cf6"}20`, color: card.color ?? "#8b5cf6" }}
                    >
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{card.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.brand && `${card.brand} `}
                        {card.lastFourDigits && `•••• ${card.lastFourDigits}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Disponível</p>
                      <p className="font-bold text-sm">{formatCurrency(card.availableLimit)}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
