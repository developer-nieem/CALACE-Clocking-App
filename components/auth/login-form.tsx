"use client";

import { useActionState } from "react";
import { loginAction, type AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_PASSWORD } from "@/lib/constants";

const demoAccounts = [
  ["Super Admin", "superadmin@calace.team"],
  ["Admin", "admin@calace.team"],
  ["Scheduler", "scheduler@calace.team"],
  ["Maria Santos", "maria.santos@calace.team"],
  ["Olivia Wilson (Staff)", "olivia.wilson@calace.team"],
];

export function LoginForm({ demoMode = false }: { demoMode?: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, {} as AuthState);

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <div className="mb-2 flex flex-col items-center text-center">
          <img src="/logo.png" alt="CALACE Team" className="mb-3 h-24 w-24 rounded-xl object-cover" />
          <CardTitle>CALACE Team</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to workforce operations</p>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              defaultValue={demoMode ? "admin@calace.team" : ""}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              defaultValue={demoMode ? DEMO_PASSWORD : ""}
              required
            />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        {demoMode ? (
          <div className="mt-6 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Demo accounts</p>
            <p className="mt-1">Password: {DEMO_PASSWORD}</p>
            <ul className="mt-2 space-y-1">
              {demoAccounts.map(([label, email]) => (
                <li key={email}>
                  {label}: {email}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
