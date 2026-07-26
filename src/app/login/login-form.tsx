"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signIn, type AuthState } from "@/app/auth/actions";
import { Button, Field, ErrorNote } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useFormState<AuthState, FormData>(signIn, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <ErrorNote>{state.error}</ErrorNote>
      <Submit />
      <p className="text-center text-sm text-sage">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-ice">
          Create an account
        </Link>
      </p>
    </form>
  );
}
