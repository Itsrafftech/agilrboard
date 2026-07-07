"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Users2, ListChecks } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateProjectModal } from "@/components/project/create-project-modal";
import { ROLE_LABELS } from "@/types";

export default function ProjectsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const { data: projects, isLoading } = trpc.project.list.useQuery();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">Pick a project or create a new one to get started.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New project
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </Card>
          ))}
        </div>
      )}

      {!isLoading && projects?.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-500">No projects yet.</p>
          <Button className="mt-4" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Create your first project
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}/board`}>
            <Card className="h-full p-5 transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">
                  {project.key}
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  {ROLE_LABELS[project.role]}
                </span>
              </div>
              <h3 className="font-medium text-slate-900">{project.name}</h3>
              {project.description && (
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description}</p>
              )}
              <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5" />
                  {project._count.tasks} tasks
                </span>
                <span className="flex items-center gap-1">
                  <Users2 className="h-3.5 w-3.5" />
                  {project._count.projectMembers} members
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <CreateProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => router.push(`/projects/${id}/board`)}
      />
    </div>
  );
}
