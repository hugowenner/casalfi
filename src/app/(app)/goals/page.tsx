import type { Metadata } from "next";

export const metadata: Metadata = { title: "Metas" };

export default function GoalsPage() {
  return (
    <div className="px-4 py-6 md:px-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Metas</h1>
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-4xl mb-4">🎯</p>
        <p className="font-medium">Em breve</p>
        <p className="text-sm mt-1">O módulo de metas compartilhadas está sendo desenvolvido</p>
      </div>
    </div>
  );
}
