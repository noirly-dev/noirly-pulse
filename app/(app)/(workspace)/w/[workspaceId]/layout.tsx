import { notFound, redirect } from "next/navigation";
import { WorkspaceRoleProvider } from "@/src/features/workspace/WorkspaceRoleContext";
import { ApiError, getSyncProvider } from "@/src/server/api/http";

type Params = { params: Promise<{ workspaceId: string }> };

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params["params"];
}) {
  const { workspaceId } = await params;
  const { sync } = await getSyncProvider();

  let workspace;
  try {
    workspace = await sync.getWorkspace(workspaceId);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <WorkspaceRoleProvider role={workspace.role}>{children}</WorkspaceRoleProvider>
  );
}
