"use client";
import { EditWorkflowPopup } from "@/components/workflow/edit-workflow-popup";
import { authClient } from "auth/client";
import { canCreateWorkflow } from "lib/auth/client-permissions";
import { Plus } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "ui/card";
import { Button } from "ui/button";
import useSWR, { mutate } from "swr";
import { fetcher } from "lib/utils";
import { Skeleton } from "ui/skeleton";
import { ShareableCard } from "@/components/shareable-card";
import { WorkflowSummary } from "app-types/workflow";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { notify } from "lib/notify";
import { useState } from "react";

interface WorkflowListPageProps {
  userRole?: string | null;
}

export default function WorkflowListPage({
  userRole,
}: WorkflowListPageProps = {}) {
  const t = useTranslations();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const [isVisibilityChangeLoading, setIsVisibilityChangeLoading] =
    useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  const { data: workflows, isLoading } = useSWR<WorkflowSummary[]>(
    "/api/workflow",
    fetcher,
    {
      fallbackData: [],
    },
  );

  // Separate workflows into user's own and shared
  const myWorkflows =
    workflows?.filter((w) => w.userId === currentUserId) || [];
  const sharedWorkflows =
    workflows?.filter((w) => w.userId !== currentUserId) || [];

  const updateVisibility = async (
    workflowId: string,
    visibility: "private" | "public" | "readonly",
  ) => {
    try {
      setIsVisibilityChangeLoading(true);
      const response = await fetch(`/api/workflow/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });

      if (!response.ok) throw new Error("Failed to update visibility");

      // Refresh the workflows data
      mutate("/api/workflow");
      toast.success(t("Workflow.visibilityUpdated"));
    } catch {
      toast.error(t("Common.error"));
    } finally {
      setIsVisibilityChangeLoading(false);
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    const ok = await notify.confirm({
      description: t("Workflow.deleteConfirm"),
    });
    if (!ok) return;

    try {
      setIsDeleteLoading(true);
      const response = await fetch(`/api/workflow/${workflowId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete workflow");

      mutate("/api/workflow");
      toast.success(t("Workflow.deleted"));
    } catch (_error) {
      toast.error(t("Common.error"));
    } finally {
      setIsDeleteLoading(false);
    }
  };

  // Check if user can create workflows using Better Auth permissions
  const canCreate = canCreateWorkflow(userRole);

  // For regular users, combine all workflows into one list
  const displayWorkflows = canCreate
    ? myWorkflows
    : [...myWorkflows, ...sharedWorkflows];

  return (
    <div className="w-full flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold" data-testid="workflows-title">
          {t("Workflow.title")}
        </h1>
        {canCreate && (
          <EditWorkflowPopup>
            <Button
              variant="outline"
              size="sm"
              data-testid="create-workflow-button"
            >
              <Plus />
              {t("Workflow.createWorkflow")}
            </Button>
          </EditWorkflowPopup>
        )}
      </div>

      {/* My Workflows / Available Workflows Section */}
      {(canCreate || displayWorkflows.length > 0) && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {canCreate
                ? t("Workflow.myWorkflows")
                : t("Workflow.availableWorkflows")}
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoading
              ? Array(6)
                  .fill(null)
                  .map((_, index) => (
                    <Skeleton key={index} className="w-full h-[196px]" />
                  ))
              : displayWorkflows?.map((workflow) => (
                  <ShareableCard
                    key={workflow.id}
                    type="workflow"
                    item={workflow}
                    href={`/workflow/${workflow.id}`}
                    onVisibilityChange={
                      canCreate && workflow.userId === currentUserId
                        ? updateVisibility
                        : undefined
                    }
                    onDelete={
                      canCreate && workflow.userId === currentUserId
                        ? deleteWorkflow
                        : undefined
                    }
                    isVisibilityChangeLoading={isVisibilityChangeLoading}
                    isDeleteLoading={isDeleteLoading}
                    isOwner={workflow.userId === currentUserId}
                  />
                ))}
          </div>
        </div>
      )}

      {/* Only show Shared Workflows section for users who can create (to differentiate between owned and shared) */}
      {canCreate && sharedWorkflows.length > 0 && (
        <div className="flex flex-col gap-4 mt-8">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {t("Workflow.sharedWorkflows")}
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {sharedWorkflows?.map((workflow) => (
              <ShareableCard
                key={workflow.id}
                type="workflow"
                item={workflow}
                isOwner={false}
                href={`/workflow/${workflow.id}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state for users without create permission and no available workflows */}
      {!canCreate && displayWorkflows.length === 0 && !isLoading && (
        <Card className="col-span-full bg-transparent border-none">
          <CardHeader className="text-center py-12">
            <CardTitle>{t("Workflow.noAvailableWorkflows")}</CardTitle>
            <CardDescription>
              {t("Workflow.noAvailableWorkflowsDescription")}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
