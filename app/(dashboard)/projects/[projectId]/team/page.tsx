"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/project/project-header";
import { MemberList } from "@/components/team/member-list";
import { InviteMemberModal } from "@/components/project/invite-member-modal";
import { WorkloadChart } from "@/components/team/workload-chart";

export default function TeamPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const { data: session } = useSession();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: project, isLoading } = trpc.project.get.useQuery({ projectId });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <ProjectHeader
        title="Team"
        description="Manage members and see how work is distributed."
        action={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Invite member
          </Button>
        }
      />

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {project && session?.user && (
        <div className="space-y-6">
          <MemberList
            projectId={projectId}
            members={project.projectMembers}
            myRole={project.myRole}
            myUserId={session.user.id}
          />
          <WorkloadChart projectId={projectId} />
        </div>
      )}

      <InviteMemberModal projectId={projectId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
