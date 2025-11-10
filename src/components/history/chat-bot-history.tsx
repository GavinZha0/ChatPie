"use client";

import { appStore } from "@/app/store";
import { useArchives } from "@/hooks/queries/use-archives";
import { useMounted } from "@/hooks/use-mounted";
import { ThreadDropdown } from "./thread-dropdown";
import {
  deleteThreadsAction,
  deleteUnarchivedThreadsAction,
} from "@/app/api/chat/actions";
import { ChatThread } from "app-types/chat";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { handleErrorWithToast } from "ui/shared-toast";
import { Button } from "ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from "ui/sidebar";
import { TextShimmer } from "ui/text-shimmer";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { fetcher, deduplicateByKey, groupBy } from "lib/utils";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, MoreHorizontal, Trash, X } from "lucide-react";
import { Separator } from "ui/separator";
import Link from "next/link";

const MAX_THREADS_COUNT = 40;

type EnhancedChatThread = ChatThread & { lastMessageAt?: number };

type ThreadGroup = {
  label: string;
  threads: EnhancedChatThread[];
};

export function ChatBotHistory() {
  const mounted = useMounted();
  const router = useRouter();
  const t = useTranslations("Layout");
  const chatHistory = appStore((state) => state.chatHistory);
  const storeMutate = appStore((state) => state.mutate);
  const currentThreadId = appStore((state) => state.currentThreadId);
  const generatingTitleThreadIds = appStore(
    (state) => state.generatingTitleThreadIds,
  );

  const setOpen = (open: boolean) => {
    storeMutate({
      chatHistory: {
        isOpen: open,
      },
    });
  };

  const [isExpanded, setIsExpanded] = useState(false);

  useArchives();

  const { data: threadList, isLoading } = useSWR<EnhancedChatThread[]>(
    "/api/thread",
    fetcher,
    {
      onError: handleErrorWithToast,
      fallbackData: [],
      onSuccess: (data) => {
        storeMutate((prev) => {
          const groupById = groupBy(
            prev.threadList as EnhancedChatThread[],
            "id",
          );

          const generatingTitleThreads = prev.generatingTitleThreadIds
            .map((id) => {
              return groupById[id]?.[0];
            })
            .filter(Boolean) as EnhancedChatThread[];

          const list = deduplicateByKey(
            generatingTitleThreads.concat(data),
            "id",
          ) as EnhancedChatThread[];
          return {
            threadList: list.map((thread) => {
              const original = groupById[thread.id]?.[0];
              if (!original) return thread;
              if (original.title && !thread.title) {
                return {
                  ...thread,
                  title: original.title,
                };
              }
              return thread;
            }),
          };
        });
      },
    },
  );

  const hasExcessThreads = threadList && threadList.length >= MAX_THREADS_COUNT;

  const displayThreadList = useMemo(() => {
    if (!threadList) return [];
    return !isExpanded && hasExcessThreads
      ? threadList.slice(0, MAX_THREADS_COUNT)
      : threadList;
  }, [threadList, hasExcessThreads, isExpanded]);

  const threadGroupByDate = useMemo(() => {
    if (!displayThreadList || displayThreadList.length === 0) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const groups: ThreadGroup[] = [
      { label: t("today"), threads: [] },
      { label: t("yesterday"), threads: [] },
      { label: t("lastWeek"), threads: [] },
      { label: t("older"), threads: [] },
    ];

    displayThreadList.forEach((thread) => {
      const threadDate =
        (thread.lastMessageAt
          ? new Date(thread.lastMessageAt)
          : new Date(thread.createdAt)) || new Date();
      threadDate.setHours(0, 0, 0, 0);

      if (threadDate.getTime() === today.getTime()) {
        groups[0].threads.push(thread);
      } else if (threadDate.getTime() === yesterday.getTime()) {
        groups[1].threads.push(thread);
      } else if (threadDate.getTime() >= lastWeek.getTime()) {
        groups[2].threads.push(thread);
      } else {
        groups[3].threads.push(thread);
      }
    });

    return groups.filter((group) => group.threads.length > 0);
  }, [displayThreadList, t]);

  const handleDeleteAllThreads = async () => {
    await toast.promise(deleteThreadsAction(), {
      loading: t("deletingAllChats"),
      success: () => {
        mutate("/api/thread");
        router.push("/");
        return t("allChatsDeleted");
      },
      error: t("failedToDeleteAllChats"),
    });
  };

  const handleDeleteUnarchivedThreads = async () => {
    await toast.promise(deleteUnarchivedThreadsAction(), {
      loading: t("deletingUnarchivedChats"),
      success: () => {
        mutate("/api/thread");
        router.push("/");
        return t("unarchivedChatsDeleted");
      },
      error: t("failedToDeleteUnarchivedChats"),
    });
  };

  return (
    <Drawer
      handleOnly
      direction="right"
      open={chatHistory.isOpen}
      onOpenChange={setOpen}
    >
      <DrawerContent
        className="w-full md:w-xl px-2 flex flex-col"
        style={{ userSelect: "text" }}
      >
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <p className="hidden sm:flex">{t("recentChats")}</p>
            <div className="flex-1" />
            <DrawerClose asChild>
              <Button
                variant="secondary"
                className="flex items-center gap-1 rounded-full"
              >
                <X />
                <Separator orientation="vertical" />
                <span className="text-xs text-muted-foreground ml-1">ESC</span>
              </Button>
            </DrawerClose>
          </DrawerTitle>
          <DrawerDescription className="sr-only" />
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-2 pb-6">
          {isLoading || threadList?.length === 0 ? (
            <SidebarGroup>
              <SidebarGroupContent className="group-data-[collapsible=icon]:hidden group/threads">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarGroupLabel>
                      <h4 className="text-xs text-muted-foreground">
                        {t("recentChats")}
                      </h4>
                    </SidebarGroupLabel>
                    {isLoading ? (
                      Array.from({ length: 12 }).map((_, index) =>
                        mounted ? <SidebarMenuSkeleton key={index} /> : null,
                      )
                    ) : (
                      <div className="px-2 py-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          {t("noConversationsYet")}
                        </p>
                      </div>
                    )}
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : (
            threadGroupByDate.map((group, index) => {
              const isFirst = index === 0;
              return (
                <SidebarGroup key={group.label}>
                  <SidebarGroupContent className="group-data-[collapsible=icon]:hidden group/threads">
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarGroupLabel>
                          <h4 className="text-xs text-muted-foreground group-hover/threads:text-foreground transition-colors">
                            {group.label}
                          </h4>
                          <div className="flex-1" />
                          {isFirst && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="data-[state=open]:bg-input! opacity-0 data-[state=open]:opacity-100! group-hover/threads:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="right" align="start">
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={handleDeleteAllThreads}
                                >
                                  <Trash />
                                  {t("deleteAllChats")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={handleDeleteUnarchivedThreads}
                                >
                                  <Trash />
                                  {t("deleteUnarchivedChats")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </SidebarGroupLabel>

                        {group.threads.map((thread) => (
                          <SidebarMenuSub
                            key={thread.id}
                            className="group/thread mr-0"
                          >
                            <SidebarMenuSubItem>
                              <div className="flex items-center data-[state=open]:bg-input! group-hover/thread:bg-input! rounded-lg">
                                <Tooltip delayDuration={1000}>
                                  <TooltipTrigger asChild>
                                    <SidebarMenuButton
                                      asChild
                                      className="group-hover/thread:bg-transparent!"
                                      isActive={currentThreadId === thread.id}
                                    >
                                      <Link
                                        href={`/chat/${thread.id}`}
                                        className="flex items-center"
                                      >
                                        {generatingTitleThreadIds.includes(
                                          thread.id,
                                        ) ? (
                                          <TextShimmer className="truncate min-w-0">
                                            {thread.title || "New Chat"}
                                          </TextShimmer>
                                        ) : (
                                          <p className="truncate min-w-0">
                                            {thread.title || "New Chat"}
                                          </p>
                                        )}
                                      </Link>
                                    </SidebarMenuButton>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[200px] p-4 break-all overflow-y-auto max-h-[200px]">
                                    {thread.title || "New Chat"}
                                  </TooltipContent>
                                </Tooltip>

                                <ThreadDropdown
                                  side="right"
                                  align="start"
                                  threadId={thread.id}
                                  beforeTitle={thread.title}
                                >
                                  <SidebarMenuAction className="data-[state=open]:bg-input data-[state=open]:opacity-100 opacity-0 group-hover/thread:opacity-100">
                                    <MoreHorizontal />
                                  </SidebarMenuAction>
                                </ThreadDropdown>
                              </div>
                            </SidebarMenuSubItem>
                          </SidebarMenuSub>
                        ))}
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })
          )}
        </div>
        {hasExcessThreads && threadList && threadList.length > 0 && (
          <div className="w-full flex px-4 pb-4">
            <Button
              variant="secondary"
              size="sm"
              className="w-full hover:bg-input! justify-start"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <MoreHorizontal className="mr-2" />
              {isExpanded ? t("showLessChats") : t("showAllChats")}
              {isExpanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
