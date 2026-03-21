"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import useSWR from "swr";
import { useMutateAgents } from "@/hooks/queries/use-agents";
import { useChatModels } from "@/hooks/queries/use-chat-models";
import { useMcpList } from "@/hooks/queries/use-mcp-list";
import { useWorkflowToolList } from "@/hooks/queries/use-workflow-tool-list";
import { useObjectState } from "@/hooks/use-object-state";
import { useBookmark } from "@/hooks/queries/use-bookmark";
import {
  Agent,
  AgentCreateSchema,
  AgentUpdateSchema,
  AgentSummary,
} from "app-types/agent";
import { ChatMention } from "app-types/chat";
import { BACKGROUND_COLORS, EMOJI_DATA } from "lib/const";
import { cn, fetcher } from "lib/utils";
import { safe } from "ts-safe";
import { handleErrorWithToast } from "ui/shared-toast";
import { Loader, User, FileText, Cpu, Wrench } from "lucide-react";
import { Button } from "ui/button";
import { Skeleton } from "ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "ui/tabs";
import { ShareableActions, Visibility } from "@/components/shareable-actions";
import { AgentBasicInfoTab } from "./tabs/AgentBasicInfoTab";
import { AgentPromptTab } from "./tabs/AgentPromptTab";
import { AgentModelTab } from "./tabs/AgentModelTab";
import { AgentToolsTab } from "./tabs/AgentToolsTab";
import { appStore } from "@/app/store";

const defaultConfig = (): PartialBy<
  Omit<Agent, "createdAt" | "updatedAt" | "userId">,
  "id"
> => {
  // Get the global default chat model
  const currentChatModel = appStore.getState().chatModel;

  return {
    name: "",
    description: "",
    icon: {
      type: "emoji",
      value: EMOJI_DATA[0],
      style: {
        backgroundColor: BACKGROUND_COLORS[0],
      },
    },
    role: "",
    systemPrompt: "",
    tools: [] as ChatMention[],
    model: currentChatModel,
    visibility: "private",
  };
};

export function AgentEditor({
  initialAgent: initialAgentProp,
  userId,
  onClose,
}: {
  initialAgent?: Agent;
  userId: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const mutateAgents = useMutateAgents();

  const isCreating = !initialAgentProp?.id;

  const [isSaving, setIsSaving] = useState(false);

  // Agent state management
  const [agent, setAgent] = useObjectState<PartialBy<Agent, "id">>(
    initialAgentProp || (defaultConfig() as PartialBy<Agent, "id">),
  );

  // Ownership and access
  const isOwner = useMemo(() => {
    if (isCreating) return true;
    return initialAgentProp?.userId === userId;
  }, [isCreating, initialAgentProp, userId]);

  const hasEditAccess = useMemo(() => {
    if (isCreating) return true;
    return isOwner || initialAgentProp?.visibility === "public";
  }, [isCreating, isOwner, initialAgentProp]);

  // Bookmark controls
  // Note: Bookmark loading state is handled in header controls; do not block form interactions.

  // Tool loading state
  const { isLoading: isMcpLoading } = useMcpList();
  const { isLoading: isWorkflowLoading } = useWorkflowToolList();
  const isLoadingTool = useMemo(
    () => isMcpLoading || isWorkflowLoading,
    [isMcpLoading, isWorkflowLoading],
  );

  // Get model providers to check if selected model is agent type
  const { data: allProviders } = useChatModels();

  // Check if the current selected model is of agent type
  const isSelectedModelAgentType = useMemo(() => {
    if (!agent.model || !allProviders) return false;

    for (const provider of allProviders) {
      const selectedModel = provider.models.find(
        (m) =>
          m.name === agent.model?.model &&
          provider.provider === agent.model?.provider,
      );
      if (selectedModel && selectedModel.type === "agent") {
        return true;
      }
    }
    return false;
  }, [agent.model, allProviders]);

  // Clear role, systemPrompt, and mentions when agent-type model is selected
  useEffect(() => {
    if (isSelectedModelAgentType) {
      setAgent({
        role: "",
        systemPrompt: "",
        tools: [],
      });
    }
  }, [isSelectedModelAgentType, setAgent]);

  const saveAgent = useCallback(() => {
    if (agent.id) {
      // Update existing agent
      safe(() => setIsSaving(true))
        .map(() => AgentUpdateSchema.parse({ ...agent }))
        .map(JSON.stringify)
        .map(async (body) =>
          fetcher(`/api/agent/${agent.id}`, {
            method: "PUT",
            body,
          }),
        )
        .ifOk((updatedAgent) => {
          mutateAgents(updatedAgent);
          toast.success(t("Agent.updated"));
          onClose();
        })
        .ifFail(handleErrorWithToast)
        .watch(() => setIsSaving(false));
    } else {
      // Create new agent
      safe(() => setIsSaving(true))
        .map(() => AgentCreateSchema.parse({ ...(agent as Agent), userId }))
        .map(JSON.stringify)
        .map(async (body) =>
          fetcher(`/api/agent`, {
            method: "POST",
            body,
          }),
        )
        .ifOk((updatedAgent) => {
          mutateAgents(updatedAgent);
          toast.success(t("Agent.created"));
          onClose();
        })
        .ifFail(handleErrorWithToast)
        .watch(() => setIsSaving(false));
    }
  }, [agent, userId, mutateAgents, t, onClose]);

  const isLoading = useMemo(() => {
    return isLoadingTool || isSaving;
  }, [isLoadingTool, isSaving]);

  return (
    <div className="flex flex-col h-full p-2">
      <Tabs defaultValue="basic" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 mb-2">
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <User className="size-4" />
            Basic Info
          </TabsTrigger>
          <TabsTrigger value="prompt" className="flex items-center gap-2">
            <FileText className="size-4" />
            Prompt
          </TabsTrigger>
          <TabsTrigger value="model" className="flex items-center gap-2">
            <Cpu className="size-4" />
            Model
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Wrench className="size-4" />
            Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-0">
          <AgentBasicInfoTab
            agent={agent}
            setAgent={setAgent}
            isLoading={isLoading}
            hasEditAccess={hasEditAccess}
            isSelectedModelAgentType={isSelectedModelAgentType}
          />
        </TabsContent>

        <TabsContent value="prompt" className="mt-0 h-full">
          <AgentPromptTab
            agent={agent}
            setAgent={setAgent}
            isLoading={isLoading}
            hasEditAccess={hasEditAccess}
            isSelectedModelAgentType={isSelectedModelAgentType}
          />
        </TabsContent>

        <TabsContent value="model" className="mt-0">
          <AgentModelTab
            agent={agent}
            setAgent={setAgent}
            isLoading={isLoading}
            hasEditAccess={hasEditAccess}
          />
        </TabsContent>

        <TabsContent value="tools" className="mt-0 flex-1">
          <AgentToolsTab
            agent={agent}
            setAgent={setAgent}
            isLoadingTool={isLoadingTool}
            isLoading={isLoading}
            hasEditAccess={hasEditAccess}
            isSelectedModelAgentType={isSelectedModelAgentType}
          />
        </TabsContent>
      </Tabs>

      {/* Action buttons */}
      {hasEditAccess && (
        <div className={cn("flex justify-end gap-2 pt-2 border-t mt-2")}>
          {/* Save button */}
          <Button
            className="ml-auto"
            onClick={saveAgent}
            disabled={isLoading || !hasEditAccess}
            data-testid="agent-save-button"
          >
            {isSaving ? t("Common.saving") : t("Common.save")}
            {isSaving && <Loader className="size-4 animate-spin" />}
          </Button>
        </div>
      )}
    </div>
  );
}

interface EditAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string | null | undefined;
  initialData?: AgentSummary;
  userId: string;
  userRole?: string | null;
}

export function EditAgentDialog({
  open,
  onOpenChange,
  agentId,
  initialData,
  userId,
}: EditAgentDialogProps) {
  const t = useTranslations();

  const isCreating = !agentId;

  // Fetch full agent data when editing
  const {
    data: fullAgent,
    isLoading: isLoadingAgent,
    mutate: mutateFullAgent,
  } = useSWR<Agent>(agentId ? `/api/agent/${agentId}` : null, fetcher, {
    revalidateOnFocus: false,
    fallbackData: initialData as Agent | undefined,
  });

  // Determine if we have complete agent data
  const hasCompleteData = useMemo(() => {
    if (isCreating) return true;
    if (!fullAgent) return false;
    return (
      fullAgent.role !== undefined &&
      fullAgent.systemPrompt !== undefined &&
      fullAgent.tools !== undefined &&
      fullAgent.model !== undefined
    );
  }, [isCreating, fullAgent]);

  // Ownership and actions state for header controls
  const isOwner = useMemo(() => {
    if (isCreating) return true;
    return fullAgent?.userId === userId;
  }, [isCreating, fullAgent?.userId, userId]);

  const mutateAgents = useMutateAgents();
  const { toggleBookmark, isLoading: isBookmarkToggleLoadingFn } = useBookmark({
    itemType: "agent",
  });
  const isBookmarkToggleLoading = useMemo(() => {
    return (fullAgent?.id && isBookmarkToggleLoadingFn(fullAgent.id)) || false;
  }, [fullAgent?.id, isBookmarkToggleLoadingFn]);
  const [isVisibilityChangeLoading, setIsVisibilityChangeLoading] =
    useState(false);

  const updateVisibility = useCallback(
    async (visibility: Visibility) => {
      if (!fullAgent?.id) return;
      safe(() => setIsVisibilityChangeLoading(true))
        .map(() => AgentUpdateSchema.parse({ visibility }))
        .map(JSON.stringify)
        .map(async (body) =>
          fetcher(`/api/agent/${fullAgent.id}`, {
            method: "PUT",
            body,
          }),
        )
        .ifOk(() => {
          mutateFullAgent(
            { ...(fullAgent as Agent), visibility },
            { revalidate: false },
          );
          mutateAgents({ id: fullAgent.id, visibility });
          toast.success(t("Agent.visibilityUpdated"));
        })
        .ifFail(handleErrorWithToast)
        .watch(() => setIsVisibilityChangeLoading(false));
    },
    [fullAgent, mutateFullAgent, mutateAgents, t],
  );

  const handleBookmarkToggle = useCallback(async () => {
    if (!fullAgent?.id || isBookmarkToggleLoading) return;
    safe(async () => {
      await toggleBookmark({
        id: fullAgent.id!,
        itemId: fullAgent.id!,
        isBookmarked: fullAgent.isBookmarked!,
      });
    })
      .ifOk(() => {
        mutateFullAgent(
          { ...(fullAgent as Agent), isBookmarked: !fullAgent.isBookmarked },
          { revalidate: false },
        );
      })
      .ifFail(handleErrorWithToast);
  }, [fullAgent, toggleBookmark, isBookmarkToggleLoading, mutateFullAgent]);

  const headerDisabled =
    isLoadingAgent || isVisibilityChangeLoading || isBookmarkToggleLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] h-[900px] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>
              {isCreating ? t("Agent.newAgent") : t("Agent.editAgent")}
            </DialogTitle>
            {fullAgent?.id && (
              <div className="mr-4 sm:mr-4">
                <ShareableActions
                  type="agent"
                  visibility={fullAgent.visibility || "private"}
                  isBookmarked={fullAgent?.isBookmarked || false}
                  isOwner={isOwner}
                  onVisibilityChange={updateVisibility}
                  isVisibilityChangeLoading={isVisibilityChangeLoading}
                  disabled={headerDisabled}
                  onBookmarkToggle={handleBookmarkToggle}
                  isBookmarkToggleLoading={isBookmarkToggleLoading}
                />
              </div>
            )}
          </div>
        </DialogHeader>
        {/* Show loading skeleton when editing and data is incomplete */}
        {!hasCompleteData && isLoadingAgent ? (
          <div className="p-2 space-y-2 flex-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <AgentEditor
            initialAgent={fullAgent || undefined}
            userId={userId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
