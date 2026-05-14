"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { createUser, verifyCredentials } from "@/services/auth.service";
import { registerSchema, loginSchema } from "@/validators/auth";
import type { ActionResult } from "@/types";

// ── Registro ──────────────────────────────────────────────────────────────

export async function registerAction(
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0].message,
    };
  }

  try {
    const user = await createUser(parsed.data);
    await createSession({ userId: user.id, email: user.email, name: user.name });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao criar conta",
    };
  }

  redirect("/dashboard");
}

// ── Login ─────────────────────────────────────────────────────────────────

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    return { success: false, error: "Email ou senha incorretos" };
  }

  await createSession({ userId: user.id, email: user.email, name: user.name });
  redirect("/dashboard");
}

// ── Logout ────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
