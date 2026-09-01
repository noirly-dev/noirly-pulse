import type { Metadata } from "next";
import { AuthShell } from "@noirly-dev/ui";
import { NoirlyLoginButton } from "@/src/features/auth/NoirlyLoginButton";

export const metadata: Metadata = {
  title: "Sign in · Noirly Pulse",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/inbox";

  return (
    <AuthShell
      title="Sign in to Pulse"
      lead="Use your Noirly account. Email, Google, and verification are handled by Noirly Identity."
    >
      <NoirlyLoginButton redirectTo={redirectTo} />
    </AuthShell>
  );
}
