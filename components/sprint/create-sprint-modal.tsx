"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

function defaultDates() {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 14);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function CreateSprintModal({
  projectId,
  open,
  onClose,
  nextSprintNumber,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  nextSprintNumber: number;
}) {
  const dates = defaultDates();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState(dates.start);
  const [endDate, setEndDate] = useState(dates.end);
  const utils = trpc.useUtils();

  const create = trpc.sprint.create.useMutation({
    onSuccess: () => {
      toast.success("Sprint created");
      utils.sprint.list.invalidate({ projectId });
      setName("");
      setGoal("");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      projectId,
      name: name || `Sprint ${nextSprintNumber}`,
      goal: goal || undefined,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Create sprint">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sprint-name">Sprint name</Label>
          <Input
            id="sprint-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Sprint ${nextSprintNumber}`}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sprint-goal">Sprint goal</Label>
          <Textarea
            id="sprint-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="What should this sprint accomplish?"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sprint-start">Start date</Label>
            <Input
              id="sprint-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sprint-end">End date</Label>
            <Input
              id="sprint-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isLoading}>
            Create sprint
          </Button>
        </div>
      </form>
    </Modal>
  );
}
