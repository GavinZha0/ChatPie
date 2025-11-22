"use client";

import { SidebarMenuAction } from "ui/sidebar";
import Link from "next/link";
import { SidebarMenuButton, SidebarMenuSkeleton } from "ui/sidebar";
import { SidebarGroupContent, SidebarMenu, SidebarMenuItem } from "ui/sidebar";
import { SidebarGroup } from "ui/sidebar";
import {
  MoreHorizontal,
  UserPlus,
  UserRoundPlus,
  UsersRound,
  Trash,
} from "lucide-react";

import { useMounted } from "@/hooks/use-mounted";

import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { useAgents } from "@/hooks/queries/use-agents";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { AgentDropdown } from "../agent/agent-dropdown";
import { EditAgentDialog } from "../agent/edit-agent-dialog";
import { EditGroupDialog } from "../group/edit-group-dialog";
import { AgentGroup } from "app-types/agent-group";
import useSWR from "swr";
import { fetcher } from "lib/utils";
import { Separator } from "ui/separator";

import { appStore } from "@/app/store";
import { useStore } from "zustand";
import { useRouter } from "next/navigation";
import { ChatMention } from "app-types/chat";
import { BACKGROUND_COLORS, EMOJI_DATA } from "lib/const";
import { getEmojiUrl } from "lib/emoji";
import { cn } from "lib/utils";
import { canCreateAgent } from "lib/auth/client-permissions";
import { authClient } from "auth/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { notify } from "lib/notify";
import { toast } from "sonner";
import { useChatModels } from "@/hooks/queries/use-chat-models";

export function AppSidebarAgents({ userRole }: { userRole?: string | null }) {
  const mounted = useMounted();
  const t = useTranslations();
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AgentGroup | null>(null);
  const { data: session } = authClient.useSession();

  // Get current thread mentions and thread ID from store
  const currentThreadId = useStore(appStore, (state) => state.currentThreadId);
  const threadMentions = useStore(appStore, (state) => state.threadMentions);
  const {
    bookmarkedAgents,
    myAgents,
    readonlyAgents,
    isLoading,
    sharedAgents,
    agents: allAgents,
  } = useAgents({
    limit: 50,
  }); // Increase limit since we're not artificially limiting display

  const agents = useMemo(() => {
    // Show only my agents and bookmarked shared agents in the sidebar
    const combined = [...myAgents, ...bookmarkedAgents];
    // Deduplicate by id while preserving order (first occurrence wins)
    const seen = new Set<string>();
    return combined.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [bookmarkedAgents, myAgents]);

  const { data: groups = [], mutate: mutateGroups } = useSWR<AgentGroup[]>(
    "/api/agent-group?limit=50",
    fetcher,
    {
      fallbackData: [],
      revalidateOnFocus: false,
    },
  );

  const agentById = useMemo(
    () => new Map(allAgents.map((a) => [a.id, a])),
    [allAgents],
  );

  // Function to check if an agent is currently selected
  const isAgentSelected = useCallback(
    (agentId: string) => {
      if (!currentThreadId) return false;
      const currentMentions = threadMentions[currentThreadId] || [];
      return currentMentions.some(
        (mention) => mention.type === "agent" && mention.agentId === agentId,
      );
    },
    [currentThreadId, threadMentions],
  );

  const handleAgentClick = useCallback(
    (id: string) => {
      const currentThreadId = appStore.getState().currentThreadId;
      const agent = agents.find((agent) => agent.id === id);

      if (!agent) return;

      const newMention: ChatMention = {
        type: "agent",
        agentId: agent.id,
        name: agent.name,
        icon: agent.icon,
        description: agent.description,
      };

      if (currentThreadId) {
        appStore.setState((prev) => {
          const currentMentions = prev.threadMentions[currentThreadId] || [];

          const target = currentMentions.find(
            (mention) =>
              mention.type == "agent" && mention.agentId === agent.id,
          );

          if (target) {
            return prev;
          }

          return {
            threadMentions: {
              ...prev.threadMentions,
              [currentThreadId]: [
                ...currentMentions.filter((v) => v.type != "agent"),
                newMention,
              ],
            },
          };
        });
      } else {
        router.push("/");

        appStore.setState(() => ({
          pendingThreadMentions: [newMention],
        }));
      }
    },
    [agents, router],
  );

  const handleGroupClick = useCallback(
    (group: AgentGroup) => {
      const currentThreadId = appStore.getState().currentThreadId;
      const members = (group.agentIds || [])
        .map((id) => agentById.get(id))
        .filter(Boolean) as any[];

      if (members.length === 0) return;

      const newMentions: ChatMention[] = members.map((agent: any) => ({
        type: "agent",
        agentId: agent.id,
        name: agent.name,
        icon: agent.icon,
        description: agent.description,
      }));

      if (currentThreadId) {
        appStore.setState((prev) => {
          const currentMentions = prev.threadMentions[currentThreadId] || [];
          const nonAgentMentions = currentMentions.filter(
            (v) => v.type != "agent",
          );
          return {
            threadMentions: {
              ...prev.threadMentions,
              [currentThreadId]: [...nonAgentMentions, ...newMentions],
            },
          };
        });
      } else {
        router.push("/");
        appStore.setState(() => ({
          pendingThreadMentions: newMentions,
        }));
      }
    },
    [agentById, router],
  );

  const { data: chatModels, isLoading: isChatModelsLoading } = useChatModels();

  const isAgentModelAvailable = (agent: any) => {
    if (isChatModelsLoading || !chatModels) return undefined;
    if (!agent.model) return true;

    return chatModels.some(
      (provider) =>
        provider.provider === agent.model?.provider &&
        provider.models.some((model) => model.name === agent.model?.model),
    );
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="group-data-[collapsible=icon]:hidden group/agents">
        <SidebarMenu className="group/agents" data-testid="agents-sidebar-menu">
          <SidebarMenuItem className="justify-center">
            <div className="flex items-center gap-2 w-full justify-center">
              <SidebarMenuButton
                asChild
                className="relative font-semibold border border-border rounded-md px-2 py-1 justify-center"
              >
                <div className="relative w-full">
                  <Link
                    href="/groups"
                    data-testid="groups-link"
                    className={cn(
                      "block w-full text-center",
                      canCreateAgent(userRole) && "pr-6",
                    )}
                  >
                    {t("Layout.teams")}
                  </Link>
                  {canCreateAgent(userRole) && (
                    <div
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowCreateGroupDialog(true);
                      }}
                      data-testid="sidebar-create-group-button"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <UserRoundPlus className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center">
                          {t("Layout.createTeam")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </SidebarMenuButton>

              <SidebarMenuButton
                asChild
                className="relative font-semibold border border-border rounded-md px-2 py-1 justify-center"
              >
                <div className="relative w-full">
                  <Link
                    href="/agents"
                    data-testid="agents-link"
                    className={cn(
                      "block w-full text-center",
                      canCreateAgent(userRole) && "pr-6",
                    )}
                  >
                    {t("Layout.agents")}
                  </Link>
                  {canCreateAgent(userRole) && (
                    <div
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowCreateDialog(true);
                      }}
                      data-testid="sidebar-create-agent-button"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <UserPlus className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center">
                          {t("Agent.newAgent")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </SidebarMenuButton>
            </div>
          </SidebarMenuItem>
          <Separator className="my-2" />

          {isLoading ? (
            <SidebarMenuItem>
              {Array.from({ length: 2 }).map(
                (_, index) => mounted && <SidebarMenuSkeleton key={index} />,
              )}
            </SidebarMenuItem>
          ) : agents.length == 0 ? (
            <div className="px-2 mt-1">
              <div className="bg-input/40 py-8 px-4 rounded-lg text-xs overflow-hidden">
                <div className="gap-1 z-10">
                  <p className="font-semibold mb-2 text-center">
                    {sharedAgents.length + readonlyAgents.length > 0
                      ? t("Layout.availableAgents")
                      : t("Layout.noAgentsAvailable")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col min-h-0">
              <div className="relative overflow-y-auto">
                <div className={cn("w-full space-y-2")}>
                  {agents.map((agent, i) => {
                    const isSelected = isAgentSelected(agent.id);
                    const isShared = agent.userId !== session?.user?.id;
                    return (
                      <SidebarMenu
                        key={agent.id}
                        className="group/agent mr-0 w-full"
                      >
                        <SidebarMenuItem
                          className="px-2 cursor-pointer w-full"
                          onClick={() => handleAgentClick(agent.id)}
                        >
                          <SidebarMenuButton
                            asChild
                            className={cn(
                              "data-[state=open]:bg-input! w-full h-auto py-1.5",
                              isSelected && "bg-accent text-accent-foreground",
                            )}
                          >
                            <div
                              className="flex gap-1 w-full min-w-0"
                              draggable
                              onDragStart={(e) => {
                                try {
                                  e.dataTransfer.setData(
                                    "application/agent-id",
                                    agent.id,
                                  );
                                  e.dataTransfer.effectAllowed = "copy";
                                } catch {}
                              }}
                            >
                              <div
                                className={cn(
                                  "p-1 bg-background relative",
                                  isShared ? "rounded-full" : "rounded-md",
                                )}
                                style={{
                                  backgroundColor:
                                    agent.icon?.style?.backgroundColor ||
                                    BACKGROUND_COLORS[
                                      i % BACKGROUND_COLORS.length
                                    ],
                                }}
                              >
                                <Avatar
                                  className={cn(
                                    "size-7",
                                    isShared && "rounded-full",
                                  )}
                                >
                                  <AvatarImage
                                    src={
                                      agent.icon?.value
                                        ? getEmojiUrl(
                                            agent.icon.value,
                                            "apple",
                                            64,
                                          )
                                        : getEmojiUrl(
                                            EMOJI_DATA[i % EMOJI_DATA.length],
                                            "apple",
                                            64,
                                          )
                                    }
                                  />
                                  <AvatarFallback className="bg-transparent">
                                    {agent.name[0]}
                                  </AvatarFallback>
                                </Avatar>
                                {isAgentModelAvailable(agent) === false && (
                                  <div
                                    className="absolute -top-0.5 -right-0.5 size-2.5 bg-destructive rounded-full border-2 border-background"
                                    title={t("Agent.modelUnavailable")}
                                  />
                                )}
                              </div>

                              <div className="flex flex-col min-w-0 w-full text-left">
                                <p
                                  className="truncate"
                                  data-testid="sidebar-agent-name"
                                >
                                  {agent.name}
                                </p>
                                {(agent.role || agent.description) && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {agent.role || agent.description}
                                  </p>
                                )}
                              </div>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                }}
                              >
                                <AgentDropdown
                                  agent={agent}
                                  side="right"
                                  align="start"
                                >
                                  <SidebarMenuAction className="data-[state=open]:bg-input! data-[state=open]:opacity-100  opacity-0 group-hover/agent:opacity-100 mr-2">
                                    <MoreHorizontal className="size-4" />
                                  </SidebarMenuAction>
                                </AgentDropdown>
                              </div>
                            </div>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </SidebarMenu>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {groups.length > 0 && (
            <div className="flex flex-col min-h-0">
              <div className="relative overflow-y-auto">
                <div className={cn("w-full space-y-2")}>
                  {groups.map((group) => {
                    const members = (group.agentIds || [])
                      .map((id) => agentById.get(id))
                      .filter(Boolean)
                      .slice(0, 3) as any[];
                    return (
                      <SidebarMenu
                        key={group.id}
                        className="group/group mr-0 w-full"
                      >
                        <SidebarMenuItem
                          className="px-2 cursor-pointer w-full"
                          onClick={() => handleGroupClick(group)}
                        >
                          <SidebarMenuButton asChild className="w-full">
                            <div className="flex items-center min-w-0 w-full">
                              {members.length > 0 && (
                                <div className="flex -space-x-1">
                                  {members.map((m, idx) => (
                                    <Avatar
                                      key={m.id}
                                      className="size-6 rounded-md"
                                    >
                                      <AvatarImage
                                        src={
                                          m.icon?.value
                                            ? getEmojiUrl(
                                                m.icon.value,
                                                "apple",
                                                64,
                                              )
                                            : getEmojiUrl(
                                                EMOJI_DATA[
                                                  idx % EMOJI_DATA.length
                                                ],
                                                "apple",
                                                64,
                                              )
                                        }
                                      />
                                      <AvatarFallback>
                                        {m.name.slice(0, 1)}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                </div>
                              )}
                              <p
                                className="truncate"
                                data-testid="sidebar-group-name"
                              >
                                {group.name}
                              </p>
                              <div
                                className="ml-auto flex items-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                }}
                              >
                                <span className="mr-1 text-xs text-muted-foreground">
                                  ({(group.agentIds || []).length})
                                </span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <SidebarMenuAction className="data-[state=open]:bg-input! data-[state=open]:opacity-100  opacity-0 group-hover/group:opacity-100 mr-2">
                                      <MoreHorizontal className="size-4" />
                                    </SidebarMenuAction>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    side="right"
                                    align="start"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditingGroup(group);
                                      }}
                                    >
                                      <UsersRound className="mr-2 size-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={async () => {
                                        const ok = await notify.confirm({
                                          description: "Delete this group?",
                                        });
                                        if (!ok) return;
                                        const res = await fetch(
                                          `/api/agent-group/${group.id}`,
                                          { method: "DELETE" },
                                        );
                                        if (res.ok) {
                                          toast.success("Group deleted");
                                          mutateGroups();
                                        } else {
                                          toast.error("Failed to delete group");
                                        }
                                      }}
                                    >
                                      <Trash className="mr-2 size-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </SidebarMenu>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </SidebarMenu>
      </SidebarGroupContent>

      {/* Create Agent Dialog */}
      {session?.user?.id && (
        <EditAgentDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          agentId={null}
          userId={session.user.id}
          userRole={userRole}
        />
      )}

      {/* Create Group Dialog */}
      {showCreateGroupDialog && (
        <EditGroupDialog
          group={
            {
              id: 0,
              name: "",
              description: "",
              agentIds: [],
              userId: session?.user?.id || "",
              createdAt: new Date(),
              updatedAt: new Date(),
            } as AgentGroup
          }
          onClose={() => setShowCreateGroupDialog(false)}
          onUpdated={() => {
            setShowCreateGroupDialog(false);
            mutateGroups();
          }}
        />
      )}

      {/* Edit Group Dialog */}
      {editingGroup && (
        <EditGroupDialog
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onUpdated={() => {
            setEditingGroup(null);
            mutateGroups();
          }}
        />
      )}
    </SidebarGroup>
  );
}
