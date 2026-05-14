import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import type { RegisterInput } from "@/validators/auth";
import type { User } from "@/types";

export async function createUser(input: RegisterInput): Promise<User> {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("Email já cadastrado");

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await db.user.create({
    data: { name: input.name, email: input.email, passwordHash },
  });

  // Criar conta carteira padrão
  await db.account.create({
    data: {
      userId: user.id,
      name: "Carteira",
      type: "wallet",
      balance: 0,
      icon: "Wallet",
      color: "#10b981",
      isDefault: true,
    },
  });

  // Criar categorias padrão
  await db.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({
      userId: user.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      type: c.type,
      isDefault: true,
    })),
  });

  return user;
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<User | null> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export async function getUserById(id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}
