"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Eye, EyeOff, User, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsGrid } from "./stats-grid";
import { SpendingChart } from "./spending-chart";
import { CategoryChart } from "./category-chart";
import { RecentTransactions } from "./recent-transactions";
import { CoupleStats } from "./couple-stats";
import { PartnerChart } from "./partner-chart";
import { CoupleFeed } from "./couple-feed";
import { AddTransactionDialog } from "@/components/features/transactions/add-transaction-dialog";
import { formatMonthYear } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format, addMonths, subMonths, parseISO, isFuture, startOfMonth } from "date-fns";
import type { DashboardData, CoupleDashboardData } from "@/types";

interface DashboardViewProps {
  personalData: DashboardData;
  coupleData: CoupleDashboardData | null;
  userName: string;
  partnerName: string | null;
  month: string;
}

type ViewMode = "personal" | "couple";

export function DashboardView({
  personalData,
  coupleData,
  userName,
  partnerName,
  month,
}: DashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showValues, setShowValues] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("personal");

  const firstName = userName.split(" ")[0];
  const hasCouple = coupleData !== null;
  const isCouple = viewMode === "couple" && hasCouple;

  const currentDate = parseISO(`${month}-01`);
  const prevMonth = format(subMonths(currentDate, 1), "yyyy-MM");
  const nextMonth = format(addMonths(currentDate, 1), "yyyy-MM");
  const isNextFuture = isFuture(startOfMonth(addMonths(currentDate, 1)));

  function navigate(target: string) {
    router.push(`${pathname}?month=${target}`);
  }

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
          {/* Navegação de mês */}
          <div className="flex items-center gap-1 mt-0.5">
            <button
              onClick={() => navigate(prevMonth)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h1 className="text-xl font-bold capitalize min-w-[160px] text-center">
              {formatMonthYear(month + "-01")}
            </h1>
            <button
              onClick={() => !isNextFuture && navigate(nextMonth)}
              disabled={isNextFuture}
              className={cn(
                "p-1 rounded-lg transition-colors",
                isNextFuture
                  ? "text-muted-foreground/30 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
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

      {/* Toggle Pessoal / Casal */}
      {hasCouple && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-1 p-1 bg-secondary rounded-2xl w-fit"
        >
          <button
            onClick={() => setViewMode("personal")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
              viewMode === "personal"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="h-3.5 w-3.5" />
            Pessoal
          </button>
          <button
            onClick={() => setViewMode("couple")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
              viewMode === "couple"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Heart className="h-3.5 w-3.5" />
            Casal
          </button>
        </motion.div>
      )}

      {/* Conteúdo com animação de troca */}
      <AnimatePresence mode="wait">
        {!isCouple ? (
          /* ── VISÃO PESSOAL ────────────────────────────────────────── */
          <motion.div
            key="personal"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
          >
            <StatsGrid stats={personalData.stats} showValues={showValues} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <SpendingChart data={personalData.dailyChart} showValues={showValues} />
              </div>
              <div>
                <CategoryChart data={personalData.categoryStats} showValues={showValues} />
              </div>
            </div>

            <RecentTransactions
              transactions={personalData.recentTransactions}
              showValues={showValues}
            />
          </motion.div>
        ) : (
          /* ── VISÃO CASAL ──────────────────────────────────────────── */
          <motion.div
            key="couple"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
          >
            <CoupleStats data={coupleData!} showValues={showValues} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <SpendingChart data={coupleData!.dailyChart} showValues={showValues} />
              </div>
              <div>
                <PartnerChart
                  me={coupleData!.me}
                  partner={coupleData!.partner}
                  showValues={showValues}
                />
              </div>
            </div>

            <CoupleFeed
              transactions={coupleData!.recentTransactions}
              showValues={showValues}
              myId={coupleData!.me.userId}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
