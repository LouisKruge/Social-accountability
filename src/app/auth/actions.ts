"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string };

function safeRedirectTo(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  // Only allow same-origin relative paths to avoid open-redirect.
  return value.startsWith("/") && !value.startsWith("//") ? value : "/home";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirectTo(formData.get("redirectTo"));

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const redirectTo = safeRedirectTo(formData.get("redirectTo"));

  if (!displayName) return { error: "Tell us your name so your group knows who you are." };
  if (!email) return { error: "Enter your email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) return { error: error.message };

  // Seamless MVP signup: new users are auto-confirmed by a DB trigger, so if
  // signUp didn't already return a session (email-confirmation flow), sign the
  // user in immediately rather than sending them through an email round-trip.
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      // Confirmation genuinely required and blocked — fall back to the prompt.
      redirect(`/login?confirm=1&redirectTo=${encodeURIComponent(redirectTo)}`);
    }
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
