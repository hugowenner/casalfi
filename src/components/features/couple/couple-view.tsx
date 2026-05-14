"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Heart, Copy, UserPlus, Check, Loader2, Users, Link } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createCoupleAction, joinCoupleAction } from "@/actions/couple";
import { getInitials } from "@/lib/format";

interface Partner {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

interface CoupleData {
  id: string;
  partner1Id: string;
  partner1: Partner;
  partner2: Partner | null;
  status: string;
  invites: Array<{ code: string }>;
}

interface CoupleViewProps {
  couple: CoupleData | null;
  userId: string;
}

export function CoupleView({ couple, userId }: CoupleViewProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const myInviteCode = couple?.invites?.[0]?.code;
  const isActive = couple?.status === "active";
  const partner = couple
    ? couple.partner1Id === userId
      ? couple.partner2
      : couple.partner1
    : null;
  const me = couple
    ? couple.partner1Id === userId
      ? couple.partner1
      : couple.partner2
    : null;

  function copyCode() {
    if (myInviteCode) {
      navigator.clipboard.writeText(myInviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Código copiado!");
    }
  }

  function handleCreateCouple() {
    startTransition(async () => {
      const result = await createCoupleAction();
      if (result.success) {
        toast.success("Convite criado! Compartilhe o código com seu parceiro.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleJoinCouple() {
    if (!inviteCode.trim()) {
      toast.error("Digite o código do convite");
      return;
    }
    startTransition(async () => {
      const result = await joinCoupleAction(inviteCode.trim().toUpperCase());
      if (result.success) {
        toast.success("Casal vinculado com sucesso! 🎉");
        setInviteCode("");
      } else {
        toast.error(result.error);
      }
    });
  }

  // ── Sem casal ─────────────────────────────────────────────────────────────

  if (!couple) {
    return (
      <div className="px-4 py-6 md:px-8 space-y-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold">Casal</h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8 space-y-3"
        >
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto">
            <Heart className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Conecte-se com seu parceiro</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie as finanças juntos em tempo real
            </p>
          </div>
        </motion.div>

        <div className="grid gap-4">
          {/* Criar convite */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link className="h-4 w-4 text-primary" />
                Gerar código de convite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Crie um código e compartilhe com seu parceiro para se conectar.
              </p>
              <Button
                className="w-full"
                onClick={handleCreateCouple}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar código"}
              </Button>
            </CardContent>
          </Card>

          {/* Aceitar convite */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                Tenho um código de convite
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Digite o código (ex: ABCD1234)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="tracking-widest text-center font-mono text-lg"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={handleJoinCouple}
                disabled={isPending || !inviteCode}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Com casal (aguardando ou ativo) ───────────────────────────────────────

  return (
    <div className="px-4 py-6 md:px-8 space-y-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">Casal</h1>

      {/* Status */}
      <Card className="gradient-balance border-border/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {[me, partner].map((p, i) => (
                <Avatar key={i} className="h-12 w-12 border-2 border-background ring-2 ring-primary/20">
                  <AvatarFallback className="text-sm gradient-primary text-white">
                    {p ? getInitials(p.name) : "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">
                  {isActive ? `${me?.name?.split(" ")[0]} & ${partner?.name?.split(" ")[0]}` : "Aguardando parceiro"}
                </p>
                <Badge variant={isActive ? "income" : "secondary"}>
                  {isActive ? "Ativo" : "Pendente"}
                </Badge>
              </div>
              {isActive && partner && (
                <p className="text-xs text-muted-foreground mt-0.5">{partner.email}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Código de convite (se pendente e é o criador) */}
      {!isActive && myInviteCode && couple.partner1Id === userId && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Compartilhe com seu parceiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Envie este código para seu parceiro aceitar o convite:
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-secondary rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-bold tracking-[0.3em] font-mono text-primary">
                  {myInviteCode}
                </p>
              </div>
              <Button size="icon" variant="outline" onClick={copyCode}>
                {copied ? <Check className="h-4 w-4 text-income" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Válido por 7 dias</p>
          </CardContent>
        </Card>
      )}

      {/* Entrar com código do parceiro (se pendente — ainda não vinculado) */}
      {!isActive && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Tenho o código do meu parceiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Se seu parceiro já gerou um código, digite aqui para se conectar:
            </p>
            <Input
              placeholder="Digite o código (ex: ABCD1234)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="tracking-widest text-center font-mono text-lg"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={handleJoinCouple}
              disabled={isPending || !inviteCode}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar com parceiro"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Casal ativo */}
      {isActive && partner && (
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-3 font-medium">Parceiro</p>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm bg-secondary">
                    {getInitials(partner.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{partner.name}</p>
                  <p className="text-xs text-muted-foreground">{partner.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-center">
            <Heart className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">Finanças sincronizadas</p>
            <p className="text-xs text-muted-foreground mt-1">
              Todos os lançamentos são compartilhados automaticamente
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
