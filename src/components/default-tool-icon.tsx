"use client";
import { DefaultToolName, getBuiltinToolInfo } from "lib/ai/tools";
import { cn } from "lib/utils";
import { useMemo } from "react";

export function DefaultToolIcon({
  name,
  className,
}: {
  name: DefaultToolName;
  className?: string;
}) {
  return useMemo(() => {
    const toolInfo = getBuiltinToolInfo(name);
    const IconComponent = toolInfo.icon;

    return (
      <IconComponent
        className={cn(`size-3.5 text-${toolInfo.color}`, className)}
      />
    );
  }, [name, className]);
}
