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
import { useTranslations } from "next-intl";

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
  const t = useTranslations();

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
      toast.success(isCreate ? t("Agent.teamCreated") : t("Agent.teamUpdated"));
      onUpdated();
    } catch (error) {
      handleErrorWithToast(error as any);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? t("Agent.createTeam") : t("Agent.editTeam")}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? t("Agent.createTeamDescription")
              : t("Agent.editTeamDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("Agent.teamName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("Agent.teamDescription")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <Label>{t("Agent.teamMembers")}</Label>
            <DropdownMenu open={openMembers} onOpenChange={setOpenMembers}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full">
                  <div className="flex flex-wrap gap-1 w-full items-center">
                    {selectedNames.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        {t("Agent.selectMembers")}
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
                    {t("Agent.noAgentsAvailable")}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={onClose}>
              {t("Common.cancel")}
            </Button>
            <Button onClick={save} disabled={!name || members.length < 2}>
              {t("Common.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
