import { AppShell, Brand, Header, SuccessNote } from "@/components/ui";
import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; confirm?: string };
}) {
  return (
    <AppShell>
      <div className="mb-8 mt-4">
        <Brand />
      </div>
      <Header title="Welcome back" subtitle="Sign in to keep climbing." />
      {searchParams.confirm && (
        <div className="mb-4">
          <SuccessNote>
            Account created. Check your email to confirm, then sign in.
          </SuccessNote>
        </div>
      )}
      <LoginForm redirectTo={searchParams.redirectTo ?? "/home"} />
    </AppShell>
  );
}
