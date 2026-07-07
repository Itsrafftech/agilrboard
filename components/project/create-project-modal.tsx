"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const utils = trpc.useUtils();

  const create = trpc.project.create.useMutation({
    onSuccess: (project) => {
      toast.success(`Project "${project.name}" created`);
      utils.project.list.invalidate();
      setName("");
      setKey("");
      setDescription("");
      onClose();
      onCreated?.(project.id);
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({ name, key, description: description || undefined });
  }

  return (
    <Modal open={open} onClose={onClose} title="Create project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="proj-name">Project name</Label>
          <Input
            id="proj-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!key) {
                setKey(
                  e.target.value
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 4)
                    .toUpperCase()
                );
              }
            }}
            placeholder="Marketing Site Revamp"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proj-key">Project key</Label>
          <Input
            id="proj-key"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="MKT"
            maxLength={6}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proj-desc">Description (optional)</Label>
          <Textarea
            id="proj-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What is this project about?"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isLoading}>
            Create project
          </Button>
        </div>
      </form>
    </Modal>
  );
}
