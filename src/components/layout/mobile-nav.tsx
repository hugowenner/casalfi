"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Users, Target
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Início"       },
  { href: "/transactions",  icon: ArrowLeftRight,  label: "Lançamentos"  },
  { href: "/accounts",      icon: Wallet,          label: "Contas"       },
  { href: "/goals",         icon: Target,          label: "Metas"        },
  { href: "/couple",        icon: Users,           label: "Casal"        },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="glass border-t border-border/50 px-2 pb-safe">
        <div className="flex items-center justify-around py-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn("h-5 w-5 transition-transform", active && "scale-110")}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
