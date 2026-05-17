"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateTelegramLinkTokenAction, unlinkTelegramAction } from "@/actions/telegram";
import { MessageCircle, Link, LinkOff, Copy, Check } from "lucide-react";

interface TelegramConnectProps {
  isLinked: boolean;
}

export function TelegramConnect({ isLinked }: TelegramConnectProps) {
  const [isPending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [botName, setBotName] = useState<string>("casalfi_bot");
  const [copied, setCopied] = useState(false);
  const [unlinked, setUnlinked] = useState(false);
  const [linked, setLinked] = useState(isLinked);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateTelegramLinkTokenAction();
      if (result.success) {
        setToken(result.data.token);
        setBotName(result.data.botName);
      }
    });
  }

  function handleCopy() {
    if (!token) return;
    navigator.clipboard.writeText(`/vincular ${token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleUnlink() {
    startTransition(async () => {
      const result = await unlinkTelegramAction();
      if (result.success) {
        setLinked(false);
        setUnlinked(true);
        setToken(null);
      }
    });
  }

  // Conta vinculada e não foi desvinculada agora
  if (linked && !unlinked) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            Telegram
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Conta vinculada</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Você já pode enviar gastos pelo Telegram. Envie /ajuda no bot para ver os exemplos.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={handleUnlink}
            disabled={isPending}
          >
            <LinkOff className="h-3 w-3" />
            Desvincular Telegram
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-blue-500" />
          Telegram
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!token ? (
          <>
            <p className="text-sm text-muted-foreground">
              Vincule sua conta para registrar gastos diretamente pelo Telegram.
            </p>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleGenerate}
              disabled={isPending}
            >
              <Link className="h-3 w-3" />
              {isPending ? "Gerando..." : "Gerar código"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Abra o bot{" "}
              <a
                href={`https://t.me/${botName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                @{botName}
              </a>{" "}
              e envie o comando abaixo. O código expira em 10 minutos.
            </p>

            {/* Código para copiar */}
            <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3">
              <code className="flex-1 text-sm font-mono tracking-widest">
                /vincular {token}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isPending}
            >
              {isPending ? "Gerando..." : "Gerar novo código"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
