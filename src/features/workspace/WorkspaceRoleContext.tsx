"use client";

import { createContext, useContext, type ReactNode } from "react";
import { can, type PermissionAction } from "@/src/core/permissions/can";
import type { MemberRole } from "@/src/core/models/enums";

const WorkspaceRoleContext = createContext<MemberRole>("member");

export function WorkspaceRoleProvider({
  role,
  children,
}: {
  role: MemberRole;
  children: ReactNode;
}) {
  return (
    <WorkspaceRoleContext.Provider value={role}>
      {children}
    </WorkspaceRoleContext.Provider>
  );
}

export function useWorkspaceRole(): MemberRole {
  return useContext(WorkspaceRoleContext);
}

export function useCan(action: PermissionAction): boolean {
  return can(useWorkspaceRole(), action);
}
