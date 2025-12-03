"use client";

import { appStore } from "@/app/store";
import { useArchives } from "@/hooks/queries/use-archives";
import { useMounted } from "@/hooks/use-mounted";
import { ThreadDropdown } from "@/components/thread/thread-dropdown";
import {
  deleteThreadsAction,
  deleteUnarchivedThreadsAction,
} from "@/app/api/chat/actions";
import { ChatThread } from "app-types/chat";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { handleErrorWithToast } from "ui/shared-toast";
import { Button } from "ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { TextShimmer } from "ui/text-shimmer";
import { fetcher, deduplicateByKey, groupBy } from "lib/utils";
import { toast } from "sonner";
import { Star, MoreHorizontal, Trash } from "lucide-react";
import Link from "next/link";

type EnhancedChatThread = ChatThread & { lastMessageAt?: number };

type ThreadGroup = {
  label: string;
  threads: EnhancedChatThread[];
};

export function HistoryChatTab({ onClose }: { onClose: () => void }) {
  const mounted = useMounted();
  const router = useRouter();
  const t = useTranslations("Layout");
  const storeMutate = appStore((state) => state.mutate);
  const generatingTitleThreadIds = appStore(
    (state) => state.generatingTitleThreadIds,
  );

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

  const threadGroupByDate = useMemo(() => {
    if (!threadList || threadList.length === 0) {
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

    threadList.forEach((thread) => {
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
  }, [threadList, t]);

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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="flex h-full flex-col min-w-0 overflow-y-hidden"
      style={{ userSelect: "text" }}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-3">
        <span className="text-sm font-semibold text-foreground">
          {t("recentChats")}
        </span>
        <div className="flex-1" />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-6 min-w-0">
        {isLoading || threadList?.length === 0 ? (
          <div className="w-full min-w-0">
            <div className="px-2 py-3">
              <h4 className="text-xs text-muted-foreground font-medium">
                {t("recentChats")}
              </h4>
            </div>
            <div className="px-2">
              {isLoading ? (
                Array.from({ length: 12 }).map((_, index) =>
                  mounted ? (
                    <div key={index} className="w-full py-2">
                      <div className="flex items-center gap-3 p-2 rounded-lg">
                        <div className="w-8 h-8 bg-muted rounded animate-pulse" />
                        <div className="flex-1">
                          <div className="h-4 bg-muted rounded w-3/4 animate-pulse mb-2" />
                          <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ) : null,
                )
              ) : (
                <div className="px-2 py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("noConversationsYet")}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          threadGroupByDate.map((group, index) => {
            const isFirst = index === 0;
            return (
              <div key={group.label} className="w-full mb-4 min-w-0">
                <div className="px-2 py-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs text-muted-foreground font-medium">
                      {group.label}
                    </h4>
                    <div className="flex-1" />
                    {isFirst && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="left" align="start">
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
                  </div>
                </div>

                <div className="px-1 space-y-0.5 min-w-0">
                  {group.threads.map((thread) => (
                    <div
                      key={thread.id}
                      className="group/thread flex items-center px-1 py-1 rounded-md hover:bg-input transition-colors min-w-0"
                    >
                      <Link
                        href={`/chat/${thread.id}`}
                        className="grid grid-cols-[16px_1fr] gap-1.5 items-center flex-1 min-w-0"
                      >
                        {thread.isArchived ? (
                          <Star
                            className="size-3.5 text-yellow-500"
                            fill="currentColor"
                          />
                        ) : (
                          <span className="size-3.5" />
                        )}
                        {generatingTitleThreadIds.includes(thread.id) ? (
                          <TextShimmer className="truncate min-w-0">
                            {thread.title || "New Chat"}
                          </TextShimmer>
                        ) : (
                          <p className="truncate min-w-0 text-sm">
                            {thread.title || "New Chat"}
                          </p>
                        )}
                      </Link>

                      <ThreadDropdown
                        side="left"
                        align="start"
                        threadId={thread.id}
                        beforeTitle={thread.title}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover/thread:opacity-100 transition-opacity size-7"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </ThreadDropdown>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
