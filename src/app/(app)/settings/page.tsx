import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";
import { LogOut } from "lucide-react";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="px-4 py-6 md:px-8 space-y-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">Configurações</h1>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Minha conta</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="gradient-primary text-white font-semibold">
              {getInitials(session.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{session.name}</p>
            <p className="text-sm text-muted-foreground">{session.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-4">
          <form action={logoutAction}>
            <Button type="submit" variant="destructive" className="w-full gap-2">
              <LogOut className="h-4 w-4" />
              Sair da conta
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        CASALFI v1.0 · Desenvolvido por Hugo Wenner
      </p>
    </div>
  );
}
