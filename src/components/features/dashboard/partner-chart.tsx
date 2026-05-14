"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { PartnerBreakdown } from "@/types";

interface PartnerChartProps {
  me: PartnerBreakdown;
  partner: PartnerBreakdown;
  showValues: boolean;
}

export function PartnerChart({ me, partner, showValues }: PartnerChartProps) {
  const myFirstName = me.name.split(" ")[0];
  const partnerFirstName = partner.name.split(" ")[0];

  const data = [
    {
      label: "Receitas",
      [myFirstName]: me.totalIncome,
      [partnerFirstName]: partner.totalIncome,
    },
    {
      label: "Gastos",
      [myFirstName]: me.totalExpense,
      [partnerFirstName]: partner.totalExpense,
    },
  ];

  const hasData =
    me.totalIncome + me.totalExpense + partner.totalIncome + partner.totalExpense > 0;

  if (!hasData) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {myFirstName} vs {partnerFirstName}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-sm text-muted-foreground">Sem movimentações ainda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          {myFirstName} vs {partnerFirstName}
        </CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.015 265)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "oklch(0.60 0.012 265)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "oklch(0.60 0.012 265)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                showValues ? `R$${(v / 1000).toFixed(0)}k` : "•••"
              }
              width={40}
            />
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
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            />
            <Bar
              dataKey={myFirstName}
              fill="oklch(0.65 0.25 290)"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
            <Bar
              dataKey={partnerFirstName}
              fill="oklch(0.65 0.18 150)"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
