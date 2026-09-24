import { getSyncProvider } from "@/src/server/api/http";

const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL ?? process.env.AUTH_NOIRLY_ISSUER;

/**
 * Name, email and avatar come from Noirly Identity on every sign-in (§9.1);
 * Pulse never edits them locally, so changes happen on Identity.
 */
export default async function ProfileSettingsPage() {
  const { ctx } = await getSyncProvider();
  return (
    <div className="space-y-4">
      <dl className="space-y-3 border border-[var(--hairline)] bg-[var(--surface)] p-5 text-sm">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Name</dt>
          <dd className="mt-1 text-foreground">{ctx.displayName}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Email</dt>
          <dd className="mt-1 text-foreground">{ctx.email}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        Your profile is managed by your Noirly account. Changes sync to Pulse the next time
        you sign in.
      </p>
      {IDENTITY_URL ? (
        <a
          href={`${IDENTITY_URL.replace(/\/$/, "")}/account`}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm underline"
        >
          Edit on Noirly Identity
        </a>
      ) : null}
    </div>
  );
}
