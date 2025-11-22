"use client";

import { useTranslations } from "next-intl";
import { AgentSummary, AgentUpdateSchema } from "app-types/agent";
import { Card, CardDescription, CardHeader, CardTitle } from "ui/card";
import { Button } from "ui/button";
import { Plus } from "lucide-react";
import { useBookmark } from "@/hooks/queries/use-bookmark";
import { useMutateAgents } from "@/hooks/queries/use-agents";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher } from "lib/utils";
import { Visibility } from "@/components/shareable-actions";
import { ShareableCard } from "@/components/shareable-card";
import { notify } from "lib/notify";
import { useState } from "react";
import { handleErrorWithToast } from "ui/shared-toast";
import { safe } from "ts-safe";
import { canCreateAgent } from "lib/auth/client-permissions";
import { EditAgentDialog } from "./edit-agent-dialog";

interface AgentsListProps {
  initialMyAgents: AgentSummary[];
  initialSharedAgents: AgentSummary[];
  userId: string;
  userRole?: string | null;
}

export function AgentsList({
  initialMyAgents,
  initialSharedAgents,
  userId,
  userRole,
}: AgentsListProps) {
  const t = useTranslations();
  const mutateAgents = useMutateAgents();
  const [deletingAgentLoading, setDeletingAgentLoading] = useState<
    string | null
  >(null);
  const [visibilityChangeLoading, setVisibilityChangeLoading] = useState<
    string | null
  >(null);
  const [editingAgent, setEditingAgent] = useState<{
    id: string | null;
    data?: AgentSummary;
  } | null>(null);

  const { data: allAgents } = useSWR(
    "/api/agent?filters=mine,shared",
    fetcher,
    {
      fallbackData: [...initialMyAgents, ...initialSharedAgents],
    },
  );

  const myAgents =
    allAgents?.filter((agent: AgentSummary) => agent.userId === userId) ||
    initialMyAgents;

  const sharedAgents =
    allAgents?.filter((agent: AgentSummary) => agent.userId !== userId) ||
    initialSharedAgents;

  const { toggleBookmark: toggleBookmarkHook, isLoading: isBookmarkLoading } =
    useBookmark({
      itemType: "agent",
    });

  const toggleBookmark = async (agentId: string, isBookmarked: boolean) => {
    await toggleBookmarkHook({ id: agentId, isBookmarked });
  };

  const updateVisibility = async (agentId: string, visibility: Visibility) => {
    safe(() => setVisibilityChangeLoading(agentId))
      .map(() => AgentUpdateSchema.parse({ visibility }))
      .map(JSON.stringify)
      .map(async (body) =>
        fetcher(`/api/agent/${agentId}`, {
          method: "PUT",
          body,
        }),
      )
      .ifOk(() => {
        mutateAgents({ id: agentId, visibility });
        toast.success(t("Agent.visibilityUpdated"));
      })
      .ifFail((e) => {
        handleErrorWithToast(e);
        toast.error(t("Common.error"));
      })
      .watch(() => setVisibilityChangeLoading(null));
  };

  const deleteAgent = async (agentId: string) => {
    const ok = await notify.confirm({
      description: t("Agent.deleteConfirm"),
    });
    if (!ok) return;
    safe(() => setDeletingAgentLoading(agentId))
      .map(() =>
        fetcher(`/api/agent/${agentId}`, {
          method: "DELETE",
        }),
      )
      .ifOk(() => {
        mutateAgents({ id: agentId }, true);
        toast.success(t("Agent.teamDeleted"));
      })
      .ifFail((e) => {
        handleErrorWithToast(e);
        toast.error(t("Common.error"));
      })
      .watch(() => setDeletingAgentLoading(null));
  };

  // Check if user can create agents using Better Auth permissions
  const canCreate = canCreateAgent(userRole);

  const handleCreateAgent = () => {
    setEditingAgent({ id: null });
  };

  const handleEditAgent = (agent: AgentSummary) => {
    setEditingAgent({ id: agent.id, data: agent });
  };

  const handleCloseDialog = () => {
    setEditingAgent(null);
  };

  return (
    <>
      <div className="w-full flex flex-col gap-4 p-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold" data-testid="agents-title">
            {t("Layout.agents")}
          </h1>
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              data-testid="create-agent-button"
              onClick={handleCreateAgent}
            >
              <Plus />
              {t("Agent.newAgent")}
            </Button>
          )}
        </div>

        {/* My Agents Section */}
        {canCreate && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{t("Agent.myAgents")}</h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {myAgents.map((agent) => (
                <ShareableCard
                  key={agent.id}
                  type="agent"
                  item={agent}
                  onClick={() => handleEditAgent(agent)}
                  onVisibilityChange={updateVisibility}
                  isVisibilityChangeLoading={
                    visibilityChangeLoading === agent.id
                  }
                  isDeleteLoading={deletingAgentLoading === agent.id}
                  onDelete={deleteAgent}
                />
              ))}
            </div>
          </div>
        )}

        {/* Shared/Available Agents Section */}
        <div className="flex flex-col gap-4 mt-8">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {canCreate ? t("Agent.sharedAgents") : t("Agent.availableAgents")}
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {sharedAgents.map((agent) => (
              <ShareableCard
                key={agent.id}
                type="agent"
                item={agent}
                isOwner={false}
                onClick={() => handleEditAgent(agent)}
                onBookmarkToggle={toggleBookmark}
                isBookmarkToggleLoading={isBookmarkLoading(agent.id)}
              />
            ))}
            {sharedAgents.length === 0 && (
              <Card className="col-span-full bg-transparent border-none">
                <CardHeader className="text-center py-12">
                  <CardTitle>
                    {canCreate
                      ? t("Agent.noSharedAgents")
                      : t("Agent.noAvailableAgents")}
                  </CardTitle>
                  <CardDescription>
                    {canCreate
                      ? t("Agent.noSharedAgentsDescription")
                      : t("Agent.noAvailableAgentsDescription")}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Edit Agent Dialog */}
      <EditAgentDialog
        open={editingAgent !== null}
        onOpenChange={(open) => !open && handleCloseDialog()}
        agentId={editingAgent?.id}
        initialData={editingAgent?.data}
        userId={userId}
        userRole={userRole}
      />
    </>
  );
}
