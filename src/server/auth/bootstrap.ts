import { withDb } from "@/src/server/db/mongodb";
import {
  PulseUser,
  Workspace,
  WorkspaceMember,
  type PulseUserDocument,
  type WorkspaceDocument,
} from "@/src/server/models";
import { acceptPendingInvites } from "@/src/server/providers/workspace-helpers";

export type BootstrapSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export type BootstrappedAccount = {
  user: {
    id: string;
    identitySub: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  };
  personalWorkspace: {
    id: string;
    name: string;
    slug: string;
    kind: "personal";
  };
};

const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

async function ensurePersonalWorkspace(
  user: PulseUserDocument,
): Promise<WorkspaceDocument> {
  const existingMembership = await WorkspaceMember.findOne({
    userId: user._id,
    role: "owner",
  }).lean();

  if (existingMembership) {
    const workspace = await Workspace.findOne({
      _id: existingMembership.workspaceId,
      kind: "personal",
    });
    if (workspace) return workspace;
  }

  const slugBase = slugify(`${user.displayName}-personal`);
  let slug = slugBase;
  let n = 0;
  while (await Workspace.exists({ slug })) {
    n += 1;
    slug = `${slugBase}-${n}`;
  }

  const workspace = await Workspace.create({
    kind: "personal",
    name: "Personal",
    slug,
    ownerUserId: user._id,
  });

  await WorkspaceMember.create({
    workspaceId: workspace._id,
    userId: user._id,
    role: "owner",
  });

  return workspace;
}

/**
 * Resolve the Pulse user + personal workspace for an Identity session.
 *
 * Hot path is read-only. Writes only when the account is missing, profile
 * fields changed, or lastSeenAt is older than five minutes.
 */
export async function ensurePulseAccount(
  sessionUser: BootstrapSessionUser,
): Promise<BootstrappedAccount> {
  if (!sessionUser.id) {
    throw new Error("Session is missing Identity subject (sub)");
  }

  return withDb(async () => {
    const email =
      sessionUser.email?.trim().toLowerCase() || `${sessionUser.id}@users.local`;
    const displayName =
      sessionUser.name?.trim() || email.split("@")[0] || "Noirly user";
    const avatarUrl = sessionUser.image ?? null;
    const emailVerified = Boolean(sessionUser.email);

    let user = await PulseUser.findOne({ identitySub: sessionUser.id });

    if (!user) {
      user = await PulseUser.create({
        identitySub: sessionUser.id,
        email,
        displayName,
        avatarUrl,
        emailVerified,
        lastSeenAt: new Date(),
      });
      await acceptPendingInvites(user._id.toString(), email);
    } else {
      const lastSeen = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
      const needsActivity = Date.now() - lastSeen > ACTIVITY_THROTTLE_MS;
      const needsUpdate =
        user.email !== email ||
        user.displayName !== displayName ||
        (user.avatarUrl ?? null) !== avatarUrl ||
        user.emailVerified !== emailVerified;

      if (needsUpdate || needsActivity) {
        if (needsUpdate) {
          user.email = email;
          user.displayName = displayName;
          user.avatarUrl = avatarUrl;
          user.emailVerified = emailVerified;
        }
        if (needsActivity) {
          user.lastSeenAt = new Date();
        }
        await user.save();
      }

      if (needsUpdate) {
        await acceptPendingInvites(user._id.toString(), email);
      }
    }

    const workspace = await ensurePersonalWorkspace(user);

    return {
      user: {
        id: user._id.toString(),
        identitySub: user.identitySub,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
      },
      personalWorkspace: {
        id: workspace._id.toString(),
        name: workspace.name,
        slug: workspace.slug,
        kind: "personal",
      },
    };
  });
}
