"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { Button } from "ui/button";
import { Waypoints } from "lucide-react";
import { MCPIcon } from "ui/mcp-icon";
import { useTranslations } from "next-intl";

interface PromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  onCancel?: () => void;
  mcpServersCount: number;
  workflowsCount: number;
  action?: "promote" | "demote";
  agentName?: string;
}

export function PromotionDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  mcpServersCount,
  workflowsCount,
  action = "promote",
  agentName,
}: PromotionDialogProps) {
  const t = useTranslations("Agent.promotion");
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      setIsConfirming(false);
      console.error("Promotion failed:", error);
    }
  };

  const isDemotion = action === "demote";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xs"
        style={{ width: "400px", maxWidth: "400px" }}
      >
        <DialogHeader>
          <DialogTitle>{agentName || t("title")}</DialogTitle>
          <DialogDescription>
            {isDemotion ? t("demotionDescription") : t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {(mcpServersCount > 0 || workflowsCount > 0) && (
            <div className="rounded-lg bg-muted/50 p-2 space-y-2">
              {mcpServersCount > 0 && (
                <div className="flex items-center gap-2">
                  <MCPIcon className="size-4 text-blue-500" />
                  <span>
                    <span className="font-medium">
                      {t("mcpServers", { count: mcpServersCount })}
                    </span>
                  </span>
                </div>
              )}

              {workflowsCount > 0 && (
                <div className="flex items-center gap-2">
                  <Waypoints className="size-4 text-green-500" />
                  <span>
                    <span className="font-medium">
                      {t("workflows", { count: workflowsCount })}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter
          className="flex gap-2"
          style={{ justifyContent: "center" }}
        >
          <Button
            variant="outline"
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
            disabled={isConfirming}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={isConfirming}>
            {isConfirming
              ? isDemotion
                ? t("demoting")
                : t("promoting")
              : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
