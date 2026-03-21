"use client";

import {
  Lock,
  Globe,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Loader2,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { WriteIcon } from "ui/write-icon";
import { useMemo } from "react";

export type Visibility = "private" | "public";

const VISIBILITY_ICONS = {
  private: Lock,
  public: Globe,
} as const;

const VISIBILITY_CONFIG = {
  agent: {
    private: {
      label: "Agent.private",
      description: "Agent.privateDescription",
    },
    public: { label: "Agent.public", description: "Agent.publicDescription" },
  },
  workflow: {
    private: {
      label: "Workflow.private",
      description: "Workflow.privateDescription",
    },
    public: {
      label: "Workflow.public",
      description: "Workflow.publicDescription",
    },
  },
  mcp: {
    private: {
      label: "MCP.private",
      description: "MCP.privateDescription",
    },
    public: {
      label: "MCP.public",
      description: "MCP.publicDescription",
    },
  },
} as const;

interface ShareableActionsProps {
  type: "agent" | "workflow" | "mcp";
  visibility?: Visibility;
  isOwner: boolean;
  canChangeVisibility?: boolean;
  isBookmarked?: boolean;
  onEdit?: () => void;
  onVisibilityChange?: (visibility: Visibility) => void;
  isVisibilityChangeLoading?: boolean;
  onBookmarkToggle?: (isBookmarked: boolean) => void;
  isBookmarkToggleLoading?: boolean;
  onDelete?: () => void;
  isDeleteLoading?: boolean;
  renderActions?: () => React.ReactNode;
  disabled?: boolean;
}

export function ShareableActions({
  type,
  visibility,
  isOwner,
  canChangeVisibility = true,
  isBookmarked = false,
  onEdit,
  onVisibilityChange,
  onBookmarkToggle,
  onDelete,
  renderActions,
  isVisibilityChangeLoading = false,
  isBookmarkToggleLoading = false,
  isDeleteLoading = false,
  disabled = false,
}: ShareableActionsProps) {
  const t = useTranslations();

  const isAnyLoading = useMemo(
    () =>
      isVisibilityChangeLoading || isBookmarkToggleLoading || isDeleteLoading,
    [isVisibilityChangeLoading, isBookmarkToggleLoading, isDeleteLoading],
  );

  const VisibilityIcon = visibility ? VISIBILITY_ICONS[visibility] : null;

  return (
    <div className="flex items-center gap-1">
      {VisibilityIcon && (
        <>
          {isOwner && onVisibilityChange && canChangeVisibility ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-4 text-muted-foreground hover:text-foreground"
                  data-testid="visibility-button"
                  disabled={isAnyLoading || disabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onVisibilityChange(
                      visibility === "private" ? "public" : "private",
                    );
                  }}
                >
                  {isVisibilityChangeLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <VisibilityIcon className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t(VISIBILITY_CONFIG[type][visibility!].label)}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center size-4">
                  <VisibilityIcon className="size-4 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {t(VISIBILITY_CONFIG[type][visibility!].label)}
              </TooltipContent>
            </Tooltip>
          )}
        </>
      )}

      {/* Bookmark */}
      {!isOwner && onBookmarkToggle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-4 text-muted-foreground hover:text-foreground"
              data-testid="bookmark-button"
              disabled={isAnyLoading || disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBookmarkToggle(isBookmarked);
              }}
            >
              {isBookmarkToggleLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isBookmarked ? (
                <BookmarkCheck className="size-4" />
              ) : (
                <Bookmark className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t(isBookmarked ? "Agent.removeBookmark" : "Agent.addBookmark")}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Edit Action */}
      {isOwner && onEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-4 text-muted-foreground hover:text-foreground"
              disabled={isAnyLoading || disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
              }}
            >
              <WriteIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("Common.edit")}</TooltipContent>
        </Tooltip>
      )}

      {/* Custom Actions */}
      {isOwner && renderActions && renderActions()}

      {/* Delete Action */}
      {isOwner && onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-4 text-muted-foreground hover:text-destructive"
              disabled={isAnyLoading || disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
            >
              {isDeleteLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("Common.delete")}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
