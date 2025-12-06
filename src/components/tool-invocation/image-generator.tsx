"use client";

import { ToolUIPart } from "ai";
import equal from "lib/equal";
import { cn } from "lib/utils";
import { ImagesIcon, ChevronRight } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { TextShimmer } from "ui/text-shimmer";
import LetterGlitch from "ui/letter-glitch";
import { useTranslations } from "next-intl";

interface ImageGeneratorToolInvocationProps {
  part: ToolUIPart;
}

interface ImageGenerationResult {
  images: {
    url: string;
    mimeType?: string;
  }[];
  mode?: "create" | "edit" | "composite";
  model: string;
}

function PureImageGeneratorToolInvocation({
  part,
}: ImageGeneratorToolInvocationProps) {
  const t = useTranslations("Chat.Tool");
  const [isExpanded, setIsExpanded] = useState(true);
  const isGenerating = useMemo(() => {
    return !part.state.startsWith("output");
  }, [part.state]);

  const result = useMemo(() => {
    if (!part.state.startsWith("output")) return null;
    return part.output as ImageGenerationResult;
  }, [part.state, part.output]);

  const images = useMemo(() => {
    return result?.images || [];
  }, [result]);

  const mode = useMemo(() => {
    return result?.mode || "create";
  }, [result]);

  const hasError = useMemo(() => {
    return (
      part.state === "output-error" ||
      (part.state === "output-available" && result?.images.length === 0)
    );
  }, [part.state, result]);

  // Get mode-specific text
  const getModeText = (mode: string) => {
    switch (mode) {
      case "edit":
        return t("imageEditing");
      case "composite":
        return t("imageCompositing");
      default:
        return t("imageGenerating");
    }
  };

  const getModeHeader = (mode: string) => {
    switch (mode) {
      case "edit":
        return t("imageEdited");
      case "composite":
        return t("imageComposed");
      default:
        return t("imageGenerated");
    }
  };

  // Simple loading state like web-search
  if (isGenerating) {
    return (
      <div className="flex flex-col gap-4">
        <TextShimmer>{getModeText(mode)}</TextShimmer>
        <div className="w-full h-96 overflow-hidden rounded-lg">
          <LetterGlitch />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {t("imageGenerationTakeTime")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-70 transition-opacity select-none w-fit"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        {!hasError && <ImagesIcon className="size-4" />}
        <span className="font-semibold">
          {hasError ? t("imageGeneratingFailed") : getModeHeader(mode)}
        </span>
        <span className="text-xs text-muted-foreground">{result?.model}</span>
        <ChevronRight
          className={cn(
            "size-4 transition-transform text-muted-foreground",
            isExpanded && "rotate-90",
          )}
        />
      </div>

      {isExpanded && (
        <div className="w-full flex flex-col gap-3 pb-2">
          {hasError ? (
            <div className="bg-card text-muted-foreground p-6 rounded-lg text-xs border border-border/20">
              {part.errorText ??
                (result?.images.length === 0
                  ? t("imageNotGenerated")
                  : t("imageGeneratingFailedDescription"))}
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "grid gap-3",
                  images.length === 1
                    ? "grid-cols-1 max-w-xl"
                    : "grid-cols-1 md:grid-cols-2 max-w-3xl",
                )}
              >
                {images.map((image, index) => (
                  <div
                    key={index}
                    className="relative group rounded-lg overflow-hidden border border-border hover:border-primary transition-all shadow-sm hover:shadow-md"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      loading="lazy"
                      alt={`Generated image ${index + 1}`}
                      className="w-full h-auto object-cover"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <a
                        href={image.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium hover:scale-105 transition-transform"
                      >
                        Open
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const ImageGeneratorToolInvocation = memo(
  PureImageGeneratorToolInvocation,
  (prev, next) => {
    return equal(prev.part, next.part);
  },
);
