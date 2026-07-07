"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

export function InviteMemberModal({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER");
  const utils = trpc.useUtils();

  const invite = trpc.project.inviteMember.useMutation({
    onSuccess: () => {
      toast.success(`Invited ${email}`);
      utils.project.get.invalidate({ projectId });
      setEmail("");
      setRole("MEMBER");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    invite.mutate({ projectId, email, role });
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite team member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            required
          />
          <p className="text-xs text-slate-400">
            They must already have an AgileBoard account with this email.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="ADMIN">Admin — full access</option>
            <option value="MEMBER">Member — create & edit tasks</option>
            <option value="VIEWER">Viewer — read only</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={invite.isLoading}>
            Send invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
