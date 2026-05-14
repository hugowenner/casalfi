"use client";

import { motion } from "framer-motion";
import { Wallet, TrendingUp, TrendingDown, ArrowLeftRight, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/format";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CoupleDashboardData } from "@/types";

interface CoupleStatsProps {
  data: CoupleDashboardData;
  showValues: boolean;
}

const mask = "••••";

export function CoupleStats({ data, showValues }: CoupleStatsProps) {
  const { me, partner, splitSummary, combinedBalance, totalIncome, totalExpense } = data;

  const topCards = [
    {
      label: "Saldo do Casal",
      value: formatCurrency(combinedBalance),
      icon: Wallet,
      gradient: "gradient-balance",
      iconColor: "text-primary",
      valueClass: combinedBalance >= 0 ? "text-foreground" : "text-expense",
    },
    {
      label: "Receitas",
      value: formatCurrency(totalIncome),
      icon: TrendingUp,
      gradient: "",
      iconColor: "text-income",
      valueClass: "text-income",
    },
    {
      label: "Gastos",
      value: formatCurrency(totalExpense),
      icon: TrendingDown,
      gradient: "",
      iconColor: "text-expense",
      valueClass: "text-expense",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top cards */}
      <div className="grid grid-cols-3 gap-3">
        {topCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className={cn("border-border/50", card.gradient)}>
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-muted-foreground font-medium leading-tight">{card.label}</p>
                  <div className={cn("p-1 rounded-lg bg-background/30", card.iconColor)}>
                    <card.icon className="h-3 w-3" />
                  </div>
                </div>
                <p className={cn("text-sm md:text-base font-bold tabular-nums", card.valueClass)}>
                  {showValues ? card.value : mask}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Breakdown por parceiro */}
      <div className="grid grid-cols-2 gap-3">
        {[me, partner].map((p, i) => (
          <motion.div
            key={p.userId}
            initial={{ opacity: 0, x: i === 0 ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[11px] gradient-primary text-white">
                      {getInitials(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs font-semibold truncate">{p.name.split(" ")[0]}</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-income">Receitas</span>
                    <span className="text-[11px] font-medium text-income tabular-nums">
                      {showValues ? formatCurrency(p.totalIncome) : mask}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-expense">Gastos</span>
                    <span className="text-[11px] font-medium text-expense tabular-nums">
                      {showValues ? formatCurrency(p.totalExpense) : mask}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-border/40 flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">Saldo</span>
                    <span className={cn(
                      "text-[11px] font-semibold tabular-nums",
                      p.accountsBalance >= 0 ? "text-foreground" : "text-expense"
                    )}>
                      {showValues ? formatCurrency(p.accountsBalance) : mask}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Split summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <ArrowLeftRight className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-semibold">Divisão de gastos</p>
            </div>

            {totalExpense === 0 ? (
              <div className="text-center py-2">
                <Heart className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Nenhum gasto registrado ainda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Barras de progresso por pessoa */}
                <div className="space-y-2">
                  {[me, partner].map((p) => {
                    const pct = totalExpense > 0 ? (p.totalExpense / totalExpense) * 100 : 0;
                    return (
                      <div key={p.userId}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{p.name.split(" ")[0]}</span>
                          <span className="font-medium tabular-nums">
                            {showValues ? formatCurrency(p.totalExpense) : mask}
                            <span className="text-muted-foreground ml-1">
                              ({pct.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Resultado do split */}
                <div className={cn(
                  "mt-3 p-3 rounded-xl text-center text-xs font-medium",
                  splitSummary.balanced
                    ? "bg-income/10 text-income border border-income/20"
                    : "bg-primary/10 text-primary border border-primary/20"
                )}>
                  {splitSummary.balanced ? (
                    "Vocês gastaram igual! 🎉"
                  ) : showValues ? (
                    splitSummary.iOwe ? (
                      `Você deve ${formatCurrency(splitSummary.owedAmount)} a ${splitSummary.partnerName}`
                    ) : (
                      `${splitSummary.partnerName} deve ${formatCurrency(splitSummary.owedAmount)} a você`
                    )
                  ) : (
                    "Há uma diferença nos gastos"
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
