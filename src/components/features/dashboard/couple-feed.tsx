"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TransactionWithRelations } from "@/types";

interface CoupleFeedProps {
  transactions: TransactionWithRelations[];
  showValues: boolean;
  myId: string;
}

export function CoupleFeed({ transactions, showValues, myId }: CoupleFeedProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">Feed do casal</CardTitle>
        <Link href="/transactions" className="flex items-center gap-1 text-xs text-primary hover:underline">
          Ver todas <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1 p-3 pt-0">
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma transação este mês
          </p>
        ) : (
          transactions.map((tx) => {
            const isMe = tx.userId === myId;
            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors"
              >
                {/* Avatar de quem lançou */}
                <div className="relative shrink-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                    style={{ backgroundColor: `${tx.category?.color ?? "#6b7280"}25` }}
                  >
                    {tx.category?.icon ?? "💸"}
                  </div>
                  <Avatar className="absolute -bottom-1 -right-1 h-4 w-4 border border-background">
                    <AvatarFallback
                      className={cn(
                        "text-[8px] font-bold",
                        isMe ? "gradient-primary text-white" : "bg-income/30 text-income"
                      )}
                    >
                      {getInitials(tx.user.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    {isMe && (
                      <Badge variant="secondary" className="text-[9px] h-3.5 px-1 shrink-0">
                        você
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                    {tx.category && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {tx.category.name}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Valor */}
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums shrink-0",
                    tx.type === "income" ? "text-income" : "text-expense"
                  )}
                >
                  {tx.type === "income" ? "+" : "-"}
                  {showValues ? formatCurrency(tx.amount) : "R$ ••••"}
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
