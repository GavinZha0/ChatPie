"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import {
  Trash2,
  CalendarClock,
  MessageCircleXIcon,
  SquarePlus,
  SquarePen,
  ArchiveX,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { ArchiveDialog } from "@/components/archive/archive-dialog";

import { toast } from "sonner";
import type { Archive } from "app-types/archive";
import {
  deleteArchiveAction,
  removeItemFromArchiveAction,
} from "@/app/api/archive/actions";
import { deleteThreadAction } from "@/app/api/chat/actions";
import { mutate } from "swr";
import { cn } from "lib/utils";

export interface ArchiveExplorerArchive {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  threads: Array<{
    id: string;
    title: string;
    createdAt: string;
    lastMessageAt: string | null;
  }>;
}

interface ArchiveExplorerProps {
  archives: ArchiveExplorerArchive[];
  userId: string;
}

export function ArchiveExplorer({
  archives: initialArchives,
  userId,
}: ArchiveExplorerProps) {
  const t = useTranslations();
  const router = useRouter();
  const [archives, setArchives] = useState(initialArchives);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialArchives.length > 0 ? (initialArchives[0]?.id ?? null) : null,
  );
  const [addArchiveDialogOpen, setAddArchiveDialogOpen] = useState(false);
  const [editArchiveId, setEditArchiveId] = useState<string | null>(null);
  const [deleteArchiveId, setDeleteArchiveId] = useState<string | null>(null);
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingThread, setIsDeletingThread] = useState(false);

  const selectedArchive = useMemo(() => {
    if (!selectedId) return null;
    return archives.find((archive) => archive.id === selectedId) ?? null;
  }, [archives, selectedId]);

  const editArchive = useMemo<Archive | null>(() => {
    if (!editArchiveId) return null;
    const archive = archives.find((item) => item.id === editArchiveId);
    if (!archive) return null;
    return {
      id: archive.id,
      name: archive.name,
      description: archive.description,
      userId,
      createdAt: new Date(archive.createdAt),
      updatedAt: new Date(archive.updatedAt),
    } satisfies Archive;
  }, [archives, editArchiveId, userId]);

  const deleteTarget = useMemo(() => {
    if (!deleteArchiveId) return null;
    return archives.find((item) => item.id === deleteArchiveId) ?? null;
  }, [archives, deleteArchiveId]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteArchiveAction(deleteTarget.id);
      toast.success(t("Archive.archiveDeleted"));
      mutate("/api/archive");
      setDeleteArchiveId(null);
      if (selectedId === deleteTarget.id) {
        const remaining = archives.filter(
          (item) => item.id !== deleteTarget.id,
        );
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
      router.refresh();
    } catch (error) {
      console.error("Failed to delete archive:", error);
      toast.error(t("Archive.failedToDeleteArchive"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    router.refresh();
    setEditArchiveId(null);
  };

  const handleRemoveFromArchive = async (threadId: string) => {
    if (!selectedId) return;
    try {
      await removeItemFromArchiveAction(selectedId, threadId);
      toast.success(t("Archive.itemRemovedFromArchive"));

      // Update local state to remove the thread from current archive
      setArchives((prev) =>
        prev.map((archive) =>
          archive.id === selectedId
            ? {
                ...archive,
                threads: archive.threads.filter((t) => t.id !== threadId),
              }
            : archive,
        ),
      );

      // Refresh data in background without causing re-render
      mutate("/api/archive");
    } catch (error) {
      console.error("Failed to remove thread from archive:", error);
      toast.error(t("Archive.failedToUpdateArchive"));
    }
  };

  const handleDeleteThread = async () => {
    if (!deleteThreadId) return;
    setIsDeletingThread(true);
    try {
      await deleteThreadAction(deleteThreadId);
      toast.success(t("Archive.threadDeleted"));

      // Update local state to remove the thread from all archives
      setArchives((prev) =>
        prev.map((archive) => ({
          ...archive,
          threads: archive.threads.filter((t) => t.id !== deleteThreadId),
        })),
      );

      setDeleteThreadId(null);
      // Refresh thread list in background
      mutate("/api/thread");
      mutate("/api/archive");
    } catch (error) {
      console.error("Failed to delete thread:", error);
      toast.error(t("Archive.failedToDeleteThread"));
    } finally {
      setIsDeletingThread(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:h-[calc(100vh-10rem)] lg:flex-row">
      <Card className="border border-border bg-background flex w-full flex-col lg:h-full lg:w-80 lg:shrink-0">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold">
              {t("Archive.archives")}
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setAddArchiveDialogOpen(true)}
                >
                  <SquarePlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" align="center">
                {t("Archive.addArchive")}
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto px-0">
          <div
            className="flex flex-col gap-3 px-4 pb-4"
            role="listbox"
            aria-label={t("Archive.archives")}
          >
            {archives.map((archive) => {
              const isSelected = archive.id === selectedId;
              return (
                <div
                  key={archive.id}
                  role="option"
                  tabIndex={0}
                  onClick={() => setSelectedId(archive.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(archive.id);
                    }
                  }}
                  aria-selected={isSelected}
                  className={cn(
                    "group relative cursor-pointer rounded-xl border border-border bg-background p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-lg"
                      : "hover:border-primary hover:bg-primary/5",
                  )}
                >
                  <div className="flex flex-col gap-3 pr-12">
                    <h3 className="truncate text-base font-medium">
                      {archive.name}
                    </h3>
                    {archive.description ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {archive.description}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(archive.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute right-4 top-4 flex flex-col gap-2 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditArchiveId(archive.id);
                      }}
                    >
                      <SquarePen className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteArchiveId(archive.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-background flex flex-1 min-h-[320px] flex-col lg:h-full lg:min-h-0">
        <CardContent className="flex-1 overflow-y-auto px-0">
          <div className="flex flex-col gap-3 px-4 pb-4">
            {selectedArchive ? (
              selectedArchive.threads.length > 0 ? (
                selectedArchive.threads.map((thread) => (
                  <div
                    key={thread.id}
                    className="group relative rounded-xl border border-border bg-background p-4 transition-all duration-200 hover:border-primary hover:bg-primary/5"
                  >
                    <Link
                      href={`/chat/${thread.id}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="flex-1">
                        <h3 className="truncate text-base font-medium">
                          {thread.title || t("Archive.untitledThread")}
                        </h3>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground opacity-100 transition-opacity duration-200 group-hover:opacity-0">
                        {new Date(thread.createdAt).toLocaleString()}
                      </span>
                    </Link>
                    <div className="pointer-events-none absolute right-4 top-4 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(event) => {
                              event.preventDefault();
                              handleRemoveFromArchive(thread.id);
                            }}
                          >
                            <ArchiveX className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center">
                          {t("Archive.removeFromArchive")}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(event) => {
                              event.preventDefault();
                              setDeleteThreadId(thread.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center">
                          {t("Archive.deleteThread")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message={t("Archive.noThreadsInArchive")} />
              )
            ) : (
              <EmptyState message={t("Archive.selectArchiveToViewThreads")} />
            )}
          </div>
        </CardContent>
      </Card>

      <ArchiveDialog
        open={addArchiveDialogOpen}
        onOpenChange={setAddArchiveDialogOpen}
        onSuccess={() => {
          setAddArchiveDialogOpen(false);
          mutate("/api/archive");
          router.refresh();
        }}
      />

      <ArchiveDialog
        archive={editArchive ?? undefined}
        open={Boolean(editArchive)}
        onOpenChange={(open) => {
          if (!open) {
            setEditArchiveId(null);
          }
        }}
        onSuccess={handleEditSuccess}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteArchiveId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Archive.deleteArchive")}</DialogTitle>
            <DialogDescription>
              {t("Archive.confirmDeleteArchive")}
              <br />
              <br />
              {t("Archive.deleteArchiveDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteArchiveId(null)}
              disabled={isDeleting}
            >
              {t("Common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t("Common.deleting") : t("Common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteThreadId)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteThreadId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Archive.deleteThread")}</DialogTitle>
            <DialogDescription>
              {t("Archive.confirmDeleteThread")}
              <br />
              <br />
              {t("Archive.deleteThreadDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteThreadId(null)}
              disabled={isDeletingThread}
            >
              {t("Common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteThread}
              disabled={isDeletingThread}
            >
              {isDeletingThread ? t("Common.deleting") : t("Common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface EmptyStateProps {
  message: string;
}

function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-muted/40 bg-background/40 px-6 py-10 text-center text-sm text-muted-foreground">
      <MessageCircleXIcon className="h-10 w-10" />
      <p>{message}</p>
    </div>
  );
}
