"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "ui/dialog";
import { Label } from "ui/label";
import { Input } from "ui/input";
import { Textarea } from "ui/textarea";
import { Button } from "ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { Badge } from "ui/badge";
import { useAgents } from "@/hooks/queries/use-agents";
import { useEffect, useMemo, useState } from "react";
import { AgentGroup } from "app-types/agent-group";
import { toast } from "sonner";
import { handleErrorWithToast } from "ui/shared-toast";

export function EditGroupDialog({
  group,
  onClose,
  onUpdated,
}: {
  group: AgentGroup;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const isCreate = group.id === 0;
  const [name, setName] = useState(group.name || "");
  const [description, setDescription] = useState(group.description || "");
  const [members, setMembers] = useState<string[]>(group.agentIds || []);
  const [openMembers, setOpenMembers] = useState(false);
  const { agents } = useAgents({ filters: ["mine", "bookmarked"], limit: 100 });

  useEffect(() => {
    setName(group.name || "");
    setDescription(group.description || "");
    setMembers(group.agentIds || []);
  }, [group]);

  const toggleMember = (id: string) => {
    setMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const selectedNames = useMemo(() => {
    return members
      .map((id) => agents.find((x) => x.id === id)?.name || id)
      .filter(Boolean);
  }, [members, agents]);

  const save = async () => {
    try {
      const payload = { name, description, agentIds: members };
      const url = isCreate
        ? "/api/agent-group"
        : `/api/agent-group/${group.id}`;
      const method = isCreate ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(isCreate ? "Group created" : "Group updated");
      onUpdated();
    } catch (error) {
      handleErrorWithToast(error as any);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Create Group" : "Edit Group"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Create a private group to organize your agents."
              : "Update group details and manage its agent members."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <Label>Members</Label>
            <DropdownMenu open={openMembers} onOpenChange={setOpenMembers}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full">
                  <div className="flex flex-wrap gap-1 w-full items-center">
                    {selectedNames.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        Select members
                      </span>
                    ) : (
                      selectedNames.map((name, idx) => (
                        <Badge
                          key={`${name}-${idx}`}
                          variant="secondary"
                          className="max-w-full"
                        >
                          <span className="truncate max-w-40 inline-block align-middle">
                            {name}
                          </span>
                        </Badge>
                      ))
                    )}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {agents.map((a) => {
                  const checked = members.includes(a.id);
                  return (
                    <DropdownMenuCheckboxItem
                      key={a.id}
                      checked={checked}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        toggleMember(a.id);
                      }}
                    >
                      <span className="truncate">{a.name}</span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
                {!agents.length && (
                  <div className="text-xs text-muted-foreground p-2">
                    No agents
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!name || members.length < 2}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
