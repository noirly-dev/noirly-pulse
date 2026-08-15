import type { MemberRole } from "@/src/core/models/enums";

export const PERMISSIONS = [
  "workspace.view",
  "message.send",
  "message.moderate",
  "channel.create",
  "channel.manage",
  "members.manage",
  "workspace.delete",
] as const;

export type PermissionAction = (typeof PERMISSIONS)[number];

const rank: Record<MemberRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

const requiredRank: Record<PermissionAction, number> = {
  "workspace.view": 1,
  "message.send": 1,
  "message.moderate": 2,
  "channel.create": 2,
  "channel.manage": 2,
  "members.manage": 2,
  "workspace.delete": 3,
};

export function can(role: MemberRole, action: PermissionAction): boolean {
  return rank[role] >= requiredRank[action];
}

export function assertCan(role: MemberRole, action: PermissionAction): void {
  if (!can(role, action)) {
    throw new Error(`Forbidden: ${action}`);
  }
}

export function roleAtLeast(role: MemberRole, min: MemberRole): boolean {
  return rank[role] >= rank[min];
}
