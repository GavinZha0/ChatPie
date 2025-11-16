"use client";
import { appStore } from "@/app/store";
import { AudioWaveformIcon, PencilLine, UserPlus } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "lib/utils";
import { AgentGroup } from "app-types/agent-group";
import { toast } from "sonner";
import { type PropsWithChildren, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { useTranslations } from "next-intl";
import { generateUUID } from "lib/utils";
import { AgentSummary } from "app-types/agent";
import { authClient } from "auth/client";
import { EditAgentDialog } from "./edit-agent-dialog";

type Props = PropsWithChildren<{
  agent: AgentSummary;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "end" | "center";
}>;

export function AgentDropdown({ agent, children, side, align }: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { data: session } = authClient.useSession();
  const isOwner = session?.user?.id === agent.userId;
  const canEdit = isOwner || agent.visibility === "public";
  const { data: groups = [] } = useSWR<AgentGroup[]>(
    "/api/agent-group?limit=50",
    fetcher,
    {
      fallbackData: [],
      revalidateOnFocus: false,
    },
  );

  const addToGroup = async (group: AgentGroup) => {
    try {
      const current = group.agentIds || [];
      if (current.includes(agent.id)) {
        toast.info("Already in group");
        setOpen(false);
        return;
      }
      const res = await fetch(`/api/agent-group/${group.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentIds: [...current, agent.id] }),
      });
      if (!res.ok) throw new Error("Failed to add to group");
      toast.success("Added to group");
      setOpen(false);
    } catch (_error) {
      toast.error("Failed to add to group");
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]" side={side} align={align}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                appStore.setState((state) => ({
                  voiceChat: {
                    ...state.voiceChat,
                    isOpen: true,
                    threadId: generateUUID(),
                    agentId: agent.id,
                  },
                }));
                setOpen(false);
              }}
            >
              <AudioWaveformIcon className="mr-2" />
              <span>{t("Chat.VoiceChat.title")}</span>
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <UserPlus className="mr-2" />
                <span>Add to group</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {groups.map((g) => (
                    <DropdownMenuItem key={g.id} onClick={() => addToGroup(g)}>
                      <span className="truncate">{g.name}</span>
                    </DropdownMenuItem>
                  ))}
                  {groups.length === 0 && (
                    <div className="px-2 py-1.5">
                      <p className="text-xs text-muted-foreground">No groups</p>
                    </div>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            {canEdit && (
              <DropdownMenuItem
                onClick={() => {
                  setShowEditDialog(true);
                  setOpen(false);
                }}
              >
                <PencilLine className="mr-2" />
                {t("Common.edit")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {session?.user?.id && (
        <EditAgentDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          agentId={agent.id}
          initialData={agent}
          userId={session.user.id}
        />
      )}
    </>
  );
}
