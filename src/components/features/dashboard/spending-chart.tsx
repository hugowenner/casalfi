"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { DailySpending } from "@/types";

interface SpendingChartProps {
  data: DailySpending[];
  showValues: boolean;
}

export function SpendingChart({ data, showValues }: SpendingChartProps) {
  // Filtrar apenas dias com movimentação para não poluir o gráfico
  const filtered = data.filter((d) => d.income > 0 || d.expense > 0);
  const chartData = filtered.length > 0 ? filtered : data.slice(0, 15);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Evolução do mês</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.65 0.18 150)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.65 0.18 150)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.62 0.22 22)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.62 0.22 22)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.015 265)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "oklch(0.60 0.012 265)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "oklch(0.60 0.012 265)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => showValues ? `R$${(v / 1000).toFixed(0)}k` : "•••"}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.14 0.015 265)",
                border: "1px solid oklch(0.25 0.015 265)",
                borderRadius: "12px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => [
                showValues ? formatCurrency(value) : "R$ ••••",
                name === "income" ? "Receita" : "Gasto",
              ]}
              labelFormatter={(label) => `Dia ${label}`}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="oklch(0.65 0.18 150)"
              strokeWidth={2}
              fill="url(#gradIncome)"
            />
            <Area
              type="monotone"
              dataKey="expense"
              stroke="oklch(0.62 0.22 22)"
              strokeWidth={2}
              fill="url(#gradExpense)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
