"use client";
import { Card, CardHeader, CardContent } from "ui/card";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { AgentGroup } from "app-types/agent-group";
import { useAgents } from "@/hooks/queries/use-agents";
import { Pencil, Trash2, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { getEmojiUrl } from "lib/emoji";
import { cn } from "lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function GroupCard({
  group,
  onEdit: _onEdit,
  onDelete,
  onUpdated,
}: {
  group: AgentGroup;
  onEdit: (g: AgentGroup) => void;
  onDelete: (g: AgentGroup) => void;
  onUpdated: () => void;
}) {
  const { agents } = useAgents({ filters: ["mine", "bookmarked"], limit: 100 });
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(group.name || "");
  const [description, setDescription] = useState(group.description || "");
  const [memberIds, setMemberIds] = useState<string[]>(group.agentIds || []);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setName(group.name || "");
      setDescription(group.description || "");
      setMemberIds(group.agentIds || []);
    }
  }, [group, isEditing]);

  const members = memberIds
    .map((id) => agents.find((a) => a.id === id))
    .filter(Boolean) as typeof agents;

  const toggleEdit = async () => {
    if (isEditing) {
      setIsEditing(false);
      try {
        const res = await fetch(`/api/agent-group/${group.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
        if (!res.ok) throw new Error("Failed to update group");
        toast.success("Group updated");
        onUpdated();
      } catch (_e) {
        toast.error("Failed to update group");
      }
    } else {
      setIsEditing(true);
    }
  };

  const removeMember = async (agentId: string) => {
    try {
      const next = memberIds.filter((id) => id !== agentId);
      const res = await fetch(`/api/agent-group/${group.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentIds: next }),
      });
      if (!res.ok) throw new Error("Failed to remove member");
      setMemberIds(next);
      toast.success("Member removed");
      onUpdated();
    } catch (_e) {
      toast.error("Failed to remove member");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types ?? []);
    if (types.includes("application/agent-id")) e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types ?? []);
    if (!types.includes("application/agent-id")) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types ?? []);
    if (!types.includes("application/agent-id")) return;
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types ?? []);
    if (!types.includes("application/agent-id")) return;
    e.preventDefault();
    const agentId = e.dataTransfer.getData("application/agent-id");
    if (!agentId) {
      setIsDragOver(false);
      return;
    }
    try {
      const next = Array.from(new Set([...(memberIds || []), agentId]));
      const res = await fetch(`/api/agent-group/${group.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentIds: next }),
      });
      if (!res.ok) throw new Error("Failed to add member");
      setMemberIds(next);
      toast.success("Added to group");
      onUpdated();
    } catch (_e) {
      toast.error("Failed to add member");
    } finally {
      setIsDragOver(false);
    }
  };

  return (
    <Card
      className={cn(
        "relative hover:border-foreground/20 transition-colors bg-secondary/40",
        isDragOver && "ring-2 ring-primary/30 border-primary/50",
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardHeader className="mb-2">
        <div className="flex items-center gap-1">
          {isEditing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-7 text-xs sm:text-sm"
            />
          ) : (
            <h4 className="font-bold text-xs sm:text-lg truncate">{name}</h4>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={toggleEdit}>
            {isEditing ? (
              <Check className="size-4" />
            ) : (
              <Pencil className="size-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(group)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
        {isEditing ? (
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 h-7 text-xs sm:text-sm"
            placeholder="Description"
          />
        ) : (
          description && (
            <p className="text-xs text-muted-foreground truncate mt-1">
              {description}
            </p>
          )
        )}
      </CardHeader>
      <CardContent className="max-h-[240px] overflow-y-auto">
        {members.length > 0 ? (
          <div className="space-y-2 pr-2">
            {members.map((a) => (
              <div
                key={a!.id}
                className={cn(
                  "flex items-center gap-2 bg-secondary rounded-md p-2 hover:bg-input transition-colors",
                )}
              >
                <div
                  className="p-1 rounded-md ring ring-background border shrink-0"
                  style={{ backgroundColor: a!.icon?.style?.backgroundColor }}
                >
                  <Avatar className="size-5">
                    <AvatarImage
                      src={
                        a!.icon?.value
                          ? getEmojiUrl(a!.icon.value, "apple", 64)
                          : undefined
                      }
                    />
                    <AvatarFallback />
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{a!.name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMember(a!.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-secondary/30 rounded-md p-3 text-center">
            <p className="text-sm text-muted-foreground">No members</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
