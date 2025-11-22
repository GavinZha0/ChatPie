"use client";
import useSWR from "swr";
import { fetcher } from "lib/utils";
import { AgentGroup } from "app-types/agent-group";
import { Card, CardHeader, CardTitle, CardDescription } from "ui/card";
import { Button } from "ui/button";
import { Separator } from "ui/separator";
import { toast } from "sonner";
import { notify } from "lib/notify";
import { GroupCard } from "./group-card";
import { EditGroupDialog } from "./edit-group-dialog";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

export function GroupsList({ initialGroups }: { initialGroups: AgentGroup[] }) {
  const {
    data: groups = [],
    mutate,
    isLoading,
  } = useSWR<AgentGroup[]>("/api/agent-group?limit=50", fetcher, {
    fallbackData: initialGroups,
    revalidateOnFocus: false,
  });

  const [editing, setEditing] = useState<AgentGroup | null>(null);
  const t = useTranslations();
  const handleCreateGroup = () => {
    setEditing({
      // create placeholder
      id: 0,
      name: "",
      description: "",
      agentIds: [],
      userId: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AgentGroup);
  };

  const onDelete = async (group: AgentGroup) => {
    const ok = await notify.confirm({
      description: t("Agent.deleteTeamConfirm"),
    });
    if (!ok) return;
    const res = await fetch(`/api/agent-group/${group.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("Agent.deletedTeam"));
      mutate();
    } else {
      toast.error(t("Common.error"));
    }
  };

  const onEdit = (group: AgentGroup) => setEditing(group);

  const onUpdated = () => {
    setEditing(null);
    mutate();
  };

  return (
    <div className="w-full flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{t("Agent.agentTeam")}</h1>
        <Button variant="outline" size="sm" onClick={handleCreateGroup}>
          <Plus />
          {t("Agent.createTeam")}
        </Button>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {groups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdated={onUpdated}
          />
        ))}
        {groups.length === 0 && !isLoading && (
          <Card className="col-span-full bg-transparent border-none">
            <CardHeader className="text-center py-12">
              <CardTitle>No groups</CardTitle>
              <CardDescription>Create your first group</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      {editing && (
        <EditGroupDialog
          group={editing}
          onClose={() => setEditing(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}
