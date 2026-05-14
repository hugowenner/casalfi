"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { CategoryStat } from "@/types";

interface CategoryChartProps {
  data: CategoryStat[];
  showValues: boolean;
}

export function CategoryChart({ data, showValues }: CategoryChartProps) {
  if (data.length === 0) {
    return (
      <Card className="border-border/50 h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Por categoria</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-sm text-muted-foreground">Sem dados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Por categoria</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={65}
              dataKey="total"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "oklch(0.14 0.015 265)",
                border: "1px solid oklch(0.25 0.015 265)",
                borderRadius: "12px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [
                showValues ? formatCurrency(value) : "R$ ••••",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legenda */}
        <div className="space-y-2">
          {data.slice(0, 4).map((cat) => (
            <div key={cat.categoryId} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <p className="text-xs text-muted-foreground flex-1 truncate">{cat.name}</p>
              <p className="text-xs font-medium tabular-nums">
                {showValues ? formatPercent(cat.percentage, 0) : "••%"}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
