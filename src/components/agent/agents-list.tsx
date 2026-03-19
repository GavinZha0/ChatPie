"use client";

import { useTranslations } from "next-intl";
import { AgentSummary, AgentUpdateSchema } from "app-types/agent";
import { Button } from "ui/button";
import { Plus } from "lucide-react";
import { useBookmark } from "@/hooks/queries/use-bookmark";
import { useMutateAgents } from "@/hooks/queries/use-agents";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher } from "lib/utils";
import { Visibility } from "@/components/shareable-actions";
import { ShareableCard } from "@/components/shareable-card";
import { PromotionDialog } from "./promotion-dialog";
import { notify } from "lib/notify";
import { useState } from "react";
import { handleErrorWithToast } from "ui/shared-toast";
import { safe } from "ts-safe";
import { canCreateAgent } from "lib/auth/client-permissions";
import { EditAgentDialog } from "./edit-agent-dialog";
import { useChatModels } from "@/hooks/queries/use-chat-models";

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

  const { toggleBookmark: toggleBookmarkHook, isLoading: isBookmarkLoading } =
    useBookmark({
      itemType: "agent",
    });

  const bookmarkToggleAdapter = (
    agent: AgentSummary,
    isBookmarked: boolean,
  ) => {
    toggleBookmarkHook({
      id: agent.id,
      itemId: agent.id,
      isBookmarked,
    });
  };

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

  const [promotionDialog, setPromotionDialog] = useState<{
    open: boolean;
    onConfirm: () => Promise<void>;
    mcpServersCount: number;
    workflowsCount: number;
    agentData: {
      id: string;
      name: string;
      visibility: string;
    };
    action?: "promote" | "demote";
  } | null>(null);

  const [editingAgent, setEditingAgent] = useState<{
    id: string | null;
    data?: AgentSummary;
  } | null>(null);

  const updateVisibility = async (agentId: string, visibility: Visibility) => {
    const updateData = JSON.stringify(AgentUpdateSchema.parse({ visibility }));

    safe(() => setVisibilityChangeLoading(agentId))
      .map(() => updateData)
      .map(async () =>
        fetcher(`/api/agent/${agentId}`, {
          method: "PUT",
          body: updateData,
        }),
      )
      .ifOk((response) => {
        // Check if response requires confirmation
        if (response.requiresConfirmation) {
          // Show confirmation dialog
          setPromotionDialog({
            open: true,
            onConfirm: async () => {
              // Retry with confirmation flag
              const confirmData = JSON.parse(updateData);
              confirmData.confirmPromotion = true;

              await fetcher(`/api/agent/${agentId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(confirmData),
              });

              // Update agent state and show success message
              mutateAgents({ id: agentId, visibility });
              toast.success(t("Agent.visibilityUpdated"));
              setPromotionDialog(null);
            },
            mcpServersCount: response.mcpServersCount,
            workflowsCount: response.workflowsCount,
            agentData: response.agentData,
            action: response.action || "promote",
          });
        } else {
          // Normal update without confirmation required
          mutateAgents({ id: agentId, visibility });
          toast.success(t("Agent.visibilityUpdated"));
        }
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

  const { data: chatModels, isLoading: isChatModelsLoading } = useChatModels();

  const isAgentModelAvailable = (agent: AgentSummary) => {
    if (isChatModelsLoading || !chatModels) return undefined;
    if (!agent.model) return true; // No model requirement means available

    return chatModels.some(
      (provider) =>
        provider.provider === agent.model?.provider &&
        provider.models.some((model) => model.name === agent.model?.model),
    );
  };

  return (
    <>
      <div className="w-full flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
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
        {myAgents?.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{t("Agent.myAgents")}</h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
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
                  isModelAvailable={isAgentModelAvailable(agent)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Shared/Available Agents Section */}
        {sharedAgents?.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {canCreate
                  ? t("Agent.sharedAgents")
                  : t("Agent.availableAgents")}
              </h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
              {sharedAgents.map((agent) => (
                <ShareableCard
                  key={agent.id}
                  type="agent"
                  item={agent}
                  isOwner={false}
                  onClick={() => handleEditAgent(agent)}
                  onBookmarkToggle={bookmarkToggleAdapter}
                  isBookmarkToggleLoading={isBookmarkLoading(agent.id)}
                  isModelAvailable={isAgentModelAvailable(agent)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Promotion Confirmation Dialog */}
      {promotionDialog && (
        <PromotionDialog
          open={promotionDialog.open}
          onOpenChange={(open) => !open && setPromotionDialog(null)}
          onConfirm={promotionDialog.onConfirm}
          mcpServersCount={promotionDialog.mcpServersCount}
          workflowsCount={promotionDialog.workflowsCount}
          action={promotionDialog.action}
          agentName={promotionDialog.agentData.name}
        />
      )}

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
