import type { TaskPriority, TaskStatus, ProjectRole, SprintStatus } from "@prisma/client";

export type { TaskPriority, TaskStatus, ProjectRole, SprintStatus };

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "DONE", label: "Done" },
];

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; badge: string; dot: string }
> = {
  LOW: {
    label: "Low",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
  MEDIUM: {
    label: "Medium",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  HIGH: {
    label: "High",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  CRITICAL: {
    label: "Critical",
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

export const ROLE_LABELS: Record<ProjectRole, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export const SPRINT_STATUS_LABELS: Record<SprintStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

export interface TaskWithRelations {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  storyPoints: number | null;
  dueDate: Date | string | null;
  position: number;
  sprintId: string | null;
  assigneeId: string | null;
  assignee: { id: string; name: string | null; email: string; image: string | null } | null;
  labels: { id: string; name: string; color: string }[];
}
