import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

// Rotas que exigem autenticação
const PROTECTED = ["/dashboard", "/transactions", "/accounts", "/couple", "/goals", "/settings"];
// Rotas apenas para não autenticados
const AUTH_ONLY = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("casalfi-token")?.value;
  const session = token ? await verifyToken(token) : null;
  const isAuthenticated = !!session;

  // Redirecionar raiz
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(isAuthenticated ? "/dashboard" : "/login", request.url)
    );
  }

  // Proteger rotas do app
  const isProtected = PROTECTED.some((route) => pathname.startsWith(route));
  if (isProtected && !isAuthenticated) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Redirecionar autenticados fora do login/register
  const isAuthOnly = AUTH_ONLY.some((route) => pathname.startsWith(route));
  if (isAuthOnly && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
