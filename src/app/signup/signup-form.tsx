"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signUp, type AuthState } from "@/app/auth/actions";
import { Button, Field, ErrorNote } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useFormState<AuthState, FormData>(signUp, {});
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Your name" name="display_name" autoComplete="name" required
        hint="Shown to your group on the leaderboard." />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
      />
      <ErrorNote>{state.error}</ErrorNote>
      <Submit />
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600">
          Sign in
        </Link>
      </p>
    </form>
  );
}
