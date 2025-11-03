import { archiveRepository, chatRepository } from "lib/db/repository";
import { getSession } from "auth/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "ui/card";
import { MessageCircleXIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  ArchiveExplorer,
  type ArchiveExplorerArchive,
} from "@/app/(chat)/archive/archive-actions-client";

export const dynamic = "force-dynamic";

interface ArchiveWithThreads {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  threads: Array<{
    id: string;
    title: string;
    createdAt: Date;
    lastMessageAt: number | Date | null;
  }>;
}

async function getArchivesWithThreads(
  userId: string,
): Promise<ArchiveWithThreads[]> {
  const archives = await archiveRepository.getArchivesByUserId(userId);

  if (archives.length === 0) {
    return [];
  }

  const [archiveItemsLists, allThreads] = await Promise.all([
    Promise.all(
      archives.map((archive) => archiveRepository.getArchiveItems(archive.id)),
    ),
    chatRepository.selectThreadsByUserId(userId),
  ]);

  const threadMap = new Map(allThreads.map((thread) => [thread.id, thread]));

  return archives
    .map((archive, index) => {
      const { itemCount: _itemCount, ...archiveData } = archive;
      const items = archiveItemsLists[index] ?? [];
      const threads = items
        .map((item) => threadMap.get(item.itemId))
        .filter((thread): thread is (typeof allThreads)[number] =>
          Boolean(thread),
        )
        .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

      return {
        ...archiveData,
        threads,
      } satisfies ArchiveWithThreads;
    })
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export default async function ArchivePage({
  params: _params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("Archive");

  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  await _params;

  const archives = await getArchivesWithThreads(session.user.id);

  const clientArchives: ArchiveExplorerArchive[] = archives.map((archive) => ({
    id: archive.id,
    name: archive.name,
    description: archive.description,
    createdAt: archive.createdAt.toISOString(),
    updatedAt: archive.updatedAt.toISOString(),
    threads: archive.threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
      lastMessageAt:
        typeof thread.lastMessageAt === "number"
          ? new Date(thread.lastMessageAt).toISOString()
          : thread.lastMessageAt instanceof Date
            ? thread.lastMessageAt.toISOString()
            : null,
    })),
  }));

  return (
    <div className="w-full px-6 py-10">
      {clientArchives.length === 0 ? (
        <Card className="border-muted/40 border-dashed bg-transparent">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <MessageCircleXIcon className="h-12 w-12 text-muted-foreground" />
            <div className="space-y-1">
              <h3 className="text-lg font-medium">
                {t("noArchivesAvailable")}
              </h3>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ArchiveExplorer archives={clientArchives} userId={session.user.id} />
      )}
    </div>
  );
}
