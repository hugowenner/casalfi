import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Moeda ─────────────────────────────────────────────────────────────────

export function formatCurrency(
  value: number,
  options?: { compact?: boolean; showSign?: boolean }
): string {
  const { compact = false, showSign = false } = options ?? {};

  const prefix = showSign && value > 0 ? "+" : "";

  if (compact && Math.abs(value) >= 1000) {
    const compacted = Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
    return prefix + compacted;
  }

  const formatted = Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);

  return prefix + formatted;
}

// ── Datas ─────────────────────────────────────────────────────────────────

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";

  return format(d, "dd 'de' MMMM", { locale: ptBR });
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy");
}

export function formatMonthYear(date: Date | string): string {
  // parseISO interpreta strings como horário local, evitando deslocamento de fuso
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMMM 'de' yyyy", { locale: ptBR });
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

export function getCurrentMonth(): string {
  return format(new Date(), "yyyy-MM");
}

export function getMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const d = new Date(parseInt(year), parseInt(m) - 1, 1);
  return format(d, "MMM/yy", { locale: ptBR });
}

// ── Porcentagem ───────────────────────────────────────────────────────────

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// ── Iniciais do nome ──────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
