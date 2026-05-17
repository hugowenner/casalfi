# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Casalfi** — app de finanças para casais. Next.js 15 (App Router) + Prisma + autenticação JWT própria (sem NextAuth).

## Commands

```bash
npm run dev          # Inicia em localhost:3000
npm run build        # prisma generate + next build (dev/local)
npm run build:prod   # Build para produção: troca SQLite → PostgreSQL e faz db push
npm run lint         # ESLint

npm run db:push      # Sincroniza schema sem migrations (dev)
npm run db:migrate   # Cria e aplica migration (dev)
npm run db:studio    # Abre Prisma Studio
```

Não há testes automatizados no projeto.

## Banco de dados

- **Dev:** SQLite (`DATABASE_URL=file:./dev.db`)
- **Prod (Vercel):** PostgreSQL via Neon. O script `scripts/vercel-build.mjs` faz o patch do `schema.prisma` em tempo de build, trocando o provider e adicionando `directUrl`.
- Nunca commitar `schema.prisma` com `provider = "postgresql"` — o arquivo no repositório sempre usa `sqlite`.

Variáveis necessárias (ver `.env.example`): `DATABASE_URL`, `DIRECT_URL` (prod only), `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`.

## Arquitetura

### Autenticação
JWT próprio com `jose`, armazenado em cookie `httpOnly` chamado `casalfi-token` (30 dias). O middleware em `src/middleware.ts` protege as rotas e redireciona unauthenticated users. `src/lib/auth.ts` expõe `requireAuth()` — usado em todas as Server Actions para obter o `userId` da sessão.

### Fluxo de dados (sem API routes)
Toda mutação de dados usa **Next.js Server Actions** (`"use server"`) em `src/actions/`. Cada action:
1. Chama `requireAuth()` para validar a sessão
2. Valida input com Zod (`src/validators/`)
3. Chama o service correspondente em `src/services/`
4. Executa `revalidatePath()` para invalidar o cache

Leitura de dados acontece diretamente nos **Server Components** (pages), que chamam os services/`db` e passam os dados como props para Client Components.

### Modelo de casal
- Um `Couple` tem `partner1Id` (quem criou) e `partner2Id` (quem aceitou o convite).
- `Couple.status`: `"pending"` (aguardando parceiro) | `"active"` (casal formado).
- `User.coupleId` aponta para o casal do usuário.
- Lógica de convite em `src/actions/couple.ts`: se o usuário que aceita o convite tem um casal pendente próprio, esse casal é deletado antes de entrar no do parceiro.

### Dashboard duplo
O dashboard (`src/app/(app)/dashboard/page.tsx`) busca **duas** fontes de dados:
- `personalData` — só as transações do usuário logado (`coupleId: null`)
- `coupleData` — todas as transações do casal (quando `couple.status === "active"`)

O componente `DashboardView` recebe ambos e exibe um toggle Pessoal / Casal.

### Transações
`src/services/transaction.service.ts` centraliza toda lógica de transações. Ao criar/deletar, os saldos de `Account` e limites de `Card` são atualizados atomicamente via `db.$transaction()`. Datas são sempre salvas como meio-dia local (`new Date(y, mo-1, d, 12, 0, 0)`) para evitar deslocamento de fuso horário.

### Estrutura de pastas
```
src/
  actions/     # Server Actions (mutações)
  app/
    (app)/     # Rotas protegidas (dashboard, transactions, etc.)
    (auth)/    # Login e register
  components/
    features/  # Componentes por domínio (dashboard, transactions, couple…)
    ui/        # Primitivos shadcn/ui
    layout/    # Sidebar e nav mobile
  lib/         # auth, db, format, utils, constants
  services/    # Lógica de negócio (acessa Prisma diretamente)
  types/       # Types TypeScript + re-exports do Prisma
  validators/  # Schemas Zod
```
