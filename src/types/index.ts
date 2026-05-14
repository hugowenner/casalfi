import type {
  User,
  Couple,
  Account,
  Card,
  Category,
  Transaction,
  Budget,
  Goal,
} from "@prisma/client";

// ── Re-exports dos modelos Prisma ─────────────────────────────────────────

export type { User, Couple, Account, Card, Category, Transaction, Budget, Goal };

// ── Tipos compostos ───────────────────────────────────────────────────────

export type TransactionWithRelations = Transaction & {
  category: Category | null;
  account: Account | null;
  card: Card | null;
  user: Pick<User, "id" | "name" | "avatar">;
};

export type UserPublic = Pick<User, "id" | "name" | "email" | "avatar">;

export type CoupleWithPartners = Couple & {
  partner1: UserPublic;
  partner2: UserPublic | null;
};

// ── Dashboard ─────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
  savingsRate: number;
}

export interface PartnerBreakdown {
  userId: string;
  name: string;
  avatar: string | null;
  totalIncome: number;
  totalExpense: number;
  accountsBalance: number;
}

export interface SplitSummary {
  totalExpense: number;
  myExpense: number;
  partnerExpense: number;
  owedAmount: number;   // valor absoluto da diferença
  iOwe: boolean;        // true = eu devo ao parceiro; false = parceiro me deve
  balanced: boolean;    // gastos iguais
  myName: string;
  partnerName: string;
}

export interface CoupleDashboardData {
  combinedBalance: number;
  totalIncome: number;
  totalExpense: number;
  savingsRate: number;
  me: PartnerBreakdown;
  partner: PartnerBreakdown;
  splitSummary: SplitSummary;
  categoryStats: CategoryStat[];
  dailyChart: DailySpending[];
  recentTransactions: TransactionWithRelations[];
}

export interface CategoryStat {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  percentage: number;
  count: number;
}

export interface DailySpending {
  day: string;   // "01", "02" ...
  date: string;  // "2026-05-01"
  income: number;
  expense: number;
}

export interface DashboardData {
  stats: DashboardStats;
  categoryStats: CategoryStat[];
  dailyChart: DailySpending[];
  recentTransactions: TransactionWithRelations[];
}

// ── Server Action response ────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Filtros de transação ──────────────────────────────────────────────────

export interface TransactionFilters {
  month?: string;       // "2026-05"
  type?: "income" | "expense" | "transfer" | "all";
  categoryId?: string;
  search?: string;
  userId?: string;
}

// ── Navegação ─────────────────────────────────────────────────────────────

export type AppView =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "couple"
  | "goals"
  | "settings";
