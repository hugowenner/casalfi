"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types";

interface StatsGridProps {
  stats: DashboardStats;
  showValues: boolean;
}

export function StatsGrid({ stats, showValues }: StatsGridProps) {
  const mask = "••••";

  const cards = [
    {
      label: "Saldo Total",
      value: formatCurrency(stats.totalBalance),
      icon: Wallet,
      gradient: "gradient-balance",
      iconColor: "text-primary",
      valueClass: stats.totalBalance >= 0 ? "text-foreground" : "text-expense",
    },
    {
      label: "Receitas",
      value: formatCurrency(stats.monthIncome),
      icon: TrendingUp,
      gradient: "",
      iconColor: "text-income",
      valueClass: "text-income",
    },
    {
      label: "Gastos",
      value: formatCurrency(stats.monthExpense),
      icon: TrendingDown,
      gradient: "",
      iconColor: "text-expense",
      valueClass: "text-expense",
    },
    {
      label: "Taxa de poupança",
      value: formatPercent(Math.max(0, stats.savingsRate)),
      icon: PiggyBank,
      gradient: "",
      iconColor: "text-primary",
      valueClass: stats.savingsRate >= 0 ? "text-foreground" : "text-expense",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className={cn("border-border/50", card.gradient)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                <div className={cn("p-1.5 rounded-lg bg-background/30", card.iconColor)}>
                  <card.icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className={cn("text-lg font-bold tabular-nums", card.valueClass)}>
                {showValues ? card.value : mask}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
