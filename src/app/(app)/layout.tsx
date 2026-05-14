import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar userName={session.name} userEmail={session.email} />

      {/* Conteúdo principal */}
      <main className="md:pl-64 pb-20 md:pb-0 min-h-screen">
        {children}
      </main>

      <MobileNav />
    </div>
  );
}
