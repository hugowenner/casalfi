/**
 * Script de build para produção (Vercel)
 * Troca SQLite → PostgreSQL no schema antes de buildar
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const schema = readFileSync("prisma/schema.prisma", "utf-8");

const patched = schema
  .replace('provider = "sqlite"', 'provider = "postgresql"')
  .replace(
    'url      = env("DATABASE_URL")',
    'url      = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")'
  );

writeFileSync("prisma/schema.prisma", patched);
console.log("✓ Schema atualizado para PostgreSQL");

execSync("npx prisma generate", { stdio: "inherit" });
execSync("npx prisma migrate deploy", { stdio: "inherit" });
execSync("next build", { stdio: "inherit" });
