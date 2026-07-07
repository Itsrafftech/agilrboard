"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/input";
import { ROLE_LABELS } from "@/types";
import type { ProjectRole } from "@prisma/client";

export function MemberList({
  projectId,
  members,
  myRole,
  myUserId,
}: {
  projectId: string;
  members: {
    id: string;
    role: ProjectRole;
    user: { id: string; name: string | null; email: string; image: string | null };
  }[];
  myRole: ProjectRole;
  myUserId: string;
}) {
  const utils = trpc.useUtils();

  const updateRole = trpc.project.updateMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.project.get.invalidate({ projectId });
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMember = trpc.project.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed");
      utils.project.get.invalidate({ projectId });
    },
    onError: (err) => toast.error(err.message),
  });

  const isAdmin = myRole === "ADMIN";

  return (
    <Card className="divide-y divide-slate-100">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 px-5 py-3">
          <Avatar name={m.user.name} email={m.user.email} image={m.user.image} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">
              {m.user.name ?? m.user.email}
              {m.user.id === myUserId && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
            </p>
            <p className="truncate text-xs text-slate-500">{m.user.email}</p>
          </div>

          {isAdmin ? (
            <div className="flex items-center gap-2">
              <Select
                value={m.role}
                onChange={(e) =>
                  updateRole.mutate({ projectId, memberId: m.id, role: e.target.value as ProjectRole })
                }
                className="w-32"
              >
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </Select>
              <button
                onClick={() => removeMember.mutate({ projectId, memberId: m.id })}
                className="text-xs font-medium text-red-500 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {ROLE_LABELS[m.role]}
            </span>
          )}
        </div>
      ))}
    </Card>
  );
}
