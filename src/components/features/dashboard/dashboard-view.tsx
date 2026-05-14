"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsGrid } from "./stats-grid";
import { SpendingChart } from "./spending-chart";
import { CategoryChart } from "./category-chart";
import { RecentTransactions } from "./recent-transactions";
import { AddTransactionDialog } from "@/components/features/transactions/add-transaction-dialog";
import { formatMonthYear } from "@/lib/format";
import type { DashboardData } from "@/types";

interface DashboardViewProps {
  data: DashboardData;
  userName: string;
  month: string;
}

export function DashboardView({ data, userName, month }: DashboardViewProps) {
  const [showValues, setShowValues] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const firstName = userName.split(" ")[0];

  return (
    <div className="px-4 py-6 md:px-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <p className="text-sm text-muted-foreground">Olá, {firstName} 👋</p>
          <h1 className="text-xl font-bold capitalize">{formatMonthYear(month + "-01")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowValues(!showValues)}
            className="text-muted-foreground"
          >
            {showValues ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Lançar</span>
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <StatsGrid stats={data.stats} showValues={showValues} />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SpendingChart data={data.dailyChart} showValues={showValues} />
        </div>
        <div>
          <CategoryChart data={data.categoryStats} showValues={showValues} />
        </div>
      </div>

      {/* Transações recentes */}
      <RecentTransactions transactions={data.recentTransactions} showValues={showValues} />

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
