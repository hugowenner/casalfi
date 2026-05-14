"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { transactionSchema, type TransactionInput } from "@/validators/transaction";
import { createTransactionAction } from "@/actions/transactions";
import { cn } from "@/lib/utils";

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "income" | "expense";
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  defaultType = "expense",
}: AddTransactionDialogProps) {
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [isPending, startTransition] = useTransition();

  const form = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type,
      description: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      splitType: "individual",
      paidByUserId: "me",
      isRecurring: false,
    },
  });

  function onSubmit(data: TransactionInput) {
    startTransition(async () => {
      const result = await createTransactionAction({ ...data, type });
      if (result.success) {
        toast.success(type === "income" ? "Receita lançada!" : "Gasto lançado!");
        form.reset();
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-xl">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                type === t
                  ? t === "expense"
                    ? "bg-expense/20 text-expense"
                    : "bg-income/20 text-income"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "expense"
                ? <TrendingDown className="h-4 w-4" />
                : <TrendingUp className="h-4 w-4" />}
              {t === "expense" ? "Gasto" : "Receita"}
            </button>
          ))}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Valor */}
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              className="text-xl h-12 font-bold"
              {...form.register("amount", { valueAsNumber: true })}
            />
            {form.formState.errors.amount && (
              <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              placeholder={type === "expense" ? "Ex: Supermercado, Ifood..." : "Ex: Salário, Freelance..."}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" {...form.register("date")} />
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label>Observações <span className="text-muted-foreground">(opcional)</span></Label>
            <Input placeholder="Alguma observação..." {...form.register("notes")} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className={cn(
                "flex-1",
                type === "income" ? "gradient-income" : "gradient-expense"
              )}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
