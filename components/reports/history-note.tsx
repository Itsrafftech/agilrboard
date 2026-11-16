import { formatDate } from "@/lib/utils";

/** Explains, in plain words, when a report is not backed by a complete status history. */
export function HistoryNote({
  history,
  trackedFrom,
  untrackedTasks,
}: {
  history: "full" | "partial" | "none";
  trackedFrom: string | null;
  untrackedTasks: number;
}) {
  if (history === "full" && untrackedTasks === 0) return null;

  const parts: string[] = [];
  if (history === "none") {
    parts.push(
      "Historical data is not available for this sprint: task status changes were not recorded while it ran."
    );
  } else if (trackedFrom) {
    parts.push(`History is only available from ${formatDate(trackedFrom)}; earlier days are unknown and left blank.`);
  }
  if (untrackedTasks > 0) {
    parts.push(`${untrackedTasks} task${untrackedTasks === 1 ? " has" : "s have"} no recorded history and ${untrackedTasks === 1 ? "is" : "are"} not included.`);
  }

  return (
    <p role="note" className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {parts.join(" ")}
    </p>
  );
}
