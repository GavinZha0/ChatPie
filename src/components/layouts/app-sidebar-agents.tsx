"use client";

import { SidebarMenuAction } from "ui/sidebar";
import Link from "next/link";
import { SidebarMenuButton, SidebarMenuSkeleton } from "ui/sidebar";
import { SidebarGroupContent, SidebarMenu, SidebarMenuItem } from "ui/sidebar";
import { SidebarGroup } from "ui/sidebar";
import { ChevronDown, ChevronUp, MoreHorizontal, PlusIcon } from "lucide-react";

import { useMounted } from "@/hooks/use-mounted";

import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { useAgents } from "@/hooks/queries/use-agents";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { AgentDropdown } from "../agent/agent-dropdown";
import { EditAgentDialog } from "../agent/edit-agent-dialog";

import { appStore } from "@/app/store";
import { useRouter } from "next/navigation";
import { ChatMention } from "app-types/chat";
import { BACKGROUND_COLORS, EMOJI_DATA } from "lib/const";
import { getEmojiUrl } from "lib/emoji";
import { cn } from "lib/utils";
import { canCreateAgent } from "lib/auth/client-permissions";
import { authClient } from "auth/client";

const DISPLAY_LIMIT = 5; // Number of agents to show when collapsed

export function AppSidebarAgents({ userRole }: { userRole?: string | null }) {
  const mounted = useMounted();
  const t = useTranslations();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { data: session } = authClient.useSession();
  const {
    bookmarkedAgents,
    myAgents,
    readonlyAgents,
    isLoading,
    sharedAgents,
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
          pendingThreadMention: newMention,
        }));
      }
    },
    [agents, router],
  );

  return (
    <SidebarGroup>
      <SidebarGroupContent className="group-data-[collapsible=icon]:hidden group/agents">
        <SidebarMenu className="group/agents" data-testid="agents-sidebar-menu">
          <SidebarMenuItem className="justify-center">
            <SidebarMenuButton
              asChild
              className="font-semibold border border-border rounded-md px-2 py-1 justify-center"
            >
              <Link
                href="/agents"
                data-testid="agents-link"
                className="block w-full text-center"
              >
                {t("Layout.agents")}
              </Link>
            </SidebarMenuButton>
            {canCreateAgent(userRole) && (
              <SidebarMenuAction
                className="opacity-100"
                onClick={() => setShowCreateDialog(true)}
                data-testid="sidebar-create-agent-button"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PlusIcon className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center">
                    {t("Agent.newAgent")}
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuAction>
            )}
          </SidebarMenuItem>

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
                  <p className="font-semibold mb-2">
                    {sharedAgents.length + readonlyAgents.length > 0
                      ? t("Layout.availableAgents")
                      : t("Layout.noAgentsAvailable")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="relative">
                {expanded && (
                  <div className="absolute bottom-0 left-0 right-0 h-4 z-10 pointer-events-none bg-gradient-to-t from-background to-transparent" />
                )}
                <div
                  className={cn(
                    "w-full",
                    expanded && "max-h-[400px] overflow-y-auto",
                  )}
                >
                  {(expanded ? agents : agents.slice(0, DISPLAY_LIMIT))?.map(
                    (agent, i) => {
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
                              className="data-[state=open]:bg-input! w-full"
                            >
                              <div className="flex gap-1 w-full min-w-0">
                                <div
                                  className="p-1 rounded-full ring-2 ring-border bg-background"
                                  style={{
                                    backgroundColor:
                                      agent.icon?.style?.backgroundColor ||
                                      BACKGROUND_COLORS[
                                        i % BACKGROUND_COLORS.length
                                      ],
                                  }}
                                >
                                  <Avatar className="size-3.5">
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
                                </div>

                                <div className="flex items-center min-w-0 w-full">
                                  <p
                                    className="truncate"
                                    data-testid="sidebar-agent-name"
                                  >
                                    {agent.name}
                                  </p>
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
                    },
                  )}
                </div>
              </div>

              {/* Show More/Less Button */}
              {agents.length > DISPLAY_LIMIT && (
                <SidebarMenu className="group/showmore">
                  <SidebarMenuItem className="px-2 cursor-pointer">
                    <SidebarMenuButton
                      onClick={() => setExpanded(!expanded)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <div className="flex items-center gap-1">
                        <p className="text-xs">
                          {expanded
                            ? t("Common.showLess")
                            : t("Common.showMore")}
                        </p>
                        {expanded ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              )}
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
    </SidebarGroup>
  );
}
