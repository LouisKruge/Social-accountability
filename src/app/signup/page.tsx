import { AppShell, Brand, Header } from "@/components/ui";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AppShell>
      <div className="mb-8 mt-4">
        <Brand />
      </div>
      <Header title="Create your account" subtitle="Join a group and start climbing this week." />
      <SignupForm />
    </AppShell>
  );
}
