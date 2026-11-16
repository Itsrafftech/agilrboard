import { trpc } from "@/lib/trpc";

/**
 * Role of the signed-in user in `projectId`, for UI affordances only
 * (hide/disable write controls). The server enforces the real rules.
 */
export function useProjectRole(projectId: string) {
  const { data } = trpc.project.get.useQuery({ projectId });
  const role = data?.myRole;
  return {
    role,
    canWrite: role === "ADMIN" || role === "MEMBER",
    isAdmin: role === "ADMIN",
  };
}
