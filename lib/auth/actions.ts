"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { findDemoAccount } from "@/lib/demo/store";
import { authenticate, createSession, deleteSession } from "@/lib/db/neon";
import { isDatabaseMode } from "@/lib/env";
import { rateLimit, rateLimitKey, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validations/auth";

export type AuthState = {
  error?: string;
};

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(
    rateLimitKey(["login", String(formData.get("email") ?? "unknown"), ip]),
    8,
    60_000,
  );
  if (!limited.success) {
    return { error: RATE_LIMIT_MESSAGE };
  }
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials." };
  }

  const { email, password } = parsed.data;

  if (!isDatabaseMode()) {
    const account = findDemoAccount(email, password);
    if (!account) {
      return { error: "Invalid email or password." };
    }
    const cookieStore = await cookies();
    cookieStore.set(DEMO_COOKIE, account.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });
    redirect("/dashboard");
  }

  const userId = await authenticate(email, password);
  if (!userId) {
    return { error: "Invalid email or password." };
  }
  const token = await createSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/dashboard");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  try {
    if (token && isDatabaseMode()) {
      await deleteSession(token);
    }
  } catch {
    /* still clear the local session */
  }
  const expired = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    expires: new Date(0),
  };
  cookieStore.set(SESSION_COOKIE, "", expired);
  cookieStore.set(DEMO_COOKIE, "", expired);
  redirect("/login");
}
