import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0e0c1a",
};

export const metadata: Metadata = {
  title: { default: "CASALFI", template: "%s · CASALFI" },
  description: "Controle financeiro compartilhado para casais",
  authors: [{ name: "Hugo Wenner" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💸</text></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-background text-foreground`}>
        {children}
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: {
              background: "oklch(0.14 0.015 265)",
              border: "1px solid oklch(0.25 0.015 265)",
              color: "oklch(0.97 0.005 265)",
            },
          }}
        />
      </body>
    </html>
  );
}
