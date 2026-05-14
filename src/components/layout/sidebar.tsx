"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Users,
  Target, Settings, LogOut, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";
import { logoutAction } from "@/actions/auth";

const NAV_ITEMS = [
  { href: "/dashboard",    icon: LayoutDashboard, label: "Dashboard"    },
  { href: "/transactions", icon: ArrowLeftRight,  label: "Lançamentos"  },
  { href: "/accounts",     icon: Wallet,          label: "Contas"       },
  { href: "/goals",        icon: Target,          label: "Metas"        },
  { href: "/couple",       icon: Users,           label: "Casal"        },
  { href: "/settings",     icon: Settings,        label: "Configurações" },
];

interface SidebarProps {
  userName: string;
  userEmail: string;
}

export function Sidebar({ userName, userEmail }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 z-30 glass border-r border-border/50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-border/50">
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
          <DollarSign className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm">CASALFI</p>
          <p className="text-[10px] text-muted-foreground">Finanças para Casal</p>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon
                className="h-4 w-4"
                strokeWidth={active ? 2.5 : 2}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Usuário */}
      <div className="px-3 py-4 border-t border-border/50">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs gradient-primary text-white">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="icon-sm" className="text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
