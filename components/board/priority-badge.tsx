import { cn } from "@/lib/utils";
import { PRIORITY_META, type TaskPriority } from "@/types";

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.badge,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}
