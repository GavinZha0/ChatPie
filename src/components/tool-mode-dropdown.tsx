"use client";

import { appStore } from "@/app/store";
import { isShortcutEvent, Shortcuts } from "lib/keyboard-shortcuts";
import {
  Check,
  CheckIcon,
  ClipboardCheck,
  Infinity,
  PenOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "ui/button";
import { useTranslations } from "next-intl";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";

import { useShallow } from "zustand/shallow";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";

import { capitalizeFirstLetter, cn, createDebounce } from "lib/utils";

const debounce = createDebounce();

export const ToolModeDropdown = ({ disabled }: { disabled?: boolean }) => {
  const t = useTranslations("Chat.Tool");
  const [toolChoice, appStoreMutate] = appStore(
    useShallow((state) => [state.toolChoice, state.mutate]),
  );
  const [open, setOpen] = useState(false);

  const [toolChoiceChangeInfo, setToolChoiceChangeInfo] = useState(false);

  const currentToolIcon = useMemo(() => {
    switch (toolChoice) {
      case "auto":
        return <Infinity />;
      case "manual":
        return <ClipboardCheck />;
      case "none":
        return <PenOff />;
      default:
        return <Infinity />;
    }
  }, [toolChoice]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isShortcutEvent(e, Shortcuts.toolMode)) {
        e.preventDefault();
        e.stopPropagation();
        appStoreMutate(({ toolChoice }) => {
          return {
            toolChoice:
              toolChoice == "auto"
                ? "manual"
                : toolChoice == "manual"
                  ? "none"
                  : "auto",
          };
        });
        setToolChoiceChangeInfo(true);
        debounce(() => {
          setToolChoiceChangeInfo(false);
        }, 1000);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <div className="relative">
          <Tooltip open={toolChoiceChangeInfo}>
            <TooltipTrigger asChild>
              <span className="absolute inset-0 -z-10" />
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2">
              {capitalizeFirstLetter(toolChoice)}
              <CheckIcon className="size-2.5" />
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={"ghost"}
                size={"sm"}
                className={cn(
                  "rounded-full p-2! data-[state=open]:bg-input! hover:bg-input!",
                  toolChoice == "none" && "text-muted-foreground",
                  open && "bg-input!",
                )}
                onClick={() => setOpen(true)}
              >
                {currentToolIcon}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2" side="top">
              {t("selectToolMode")}
            </TooltipContent>
          </Tooltip>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => appStoreMutate({ toolChoice: "auto" })}
          >
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2">
                <Infinity />
                <span className="font-bold">Auto</span>
                {toolChoice == "auto" && <Check className="ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("autoToolModeDescription")}
              </p>
            </div>
          </DropdownMenuItem>
          <div className="px-2 py-1">
            <DropdownMenuSeparator />
          </div>
          <DropdownMenuItem
            onClick={() => appStoreMutate({ toolChoice: "manual" })}
          >
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2">
                <ClipboardCheck />
                <span className="font-bold">Manual</span>
                {toolChoice == "manual" && <Check className="ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("manualToolModeDescription")}
              </p>
            </div>
          </DropdownMenuItem>
          <div className="px-2 py-1">
            <DropdownMenuSeparator />
          </div>
          <DropdownMenuItem
            onClick={() => appStoreMutate({ toolChoice: "none" })}
          >
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2">
                <PenOff />
                <span className="font-bold">None</span>
                {toolChoice == "none" && <Check className="ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("noneToolModeDescription")}
              </p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
