"use client";

import { cn } from "lib/utils";
import { useChatModels } from "@/hooks/queries/use-chat-models";
import { CheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { ModelProviderIcon } from "ui/model-provider-icon";
import { useTranslations } from "next-intl";

interface AgentModelTabProps {
  agent: any;
  setAgent: (updates: Partial<any>) => void;
  isLoading: boolean;
  hasEditAccess: boolean;
}

export function AgentModelTab({
  agent,
  setAgent,
  isLoading,
  hasEditAccess,
}: AgentModelTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: allProviders } = useChatModels();
  const t = useTranslations("Common");

  // Filter providers for chat and agent models
  const providers = useMemo(() => {
    if (!allProviders) return allProviders;

    return allProviders
      .map((provider) => ({
        ...provider,
        // Filter models by chat and agent types
        models: provider.models.filter((model) => {
          return ["chat", "agent"].includes(model.type);
        }),
      }))
      .filter((provider) => provider.models.length > 0); // Remove providers with no matching models
  }, [allProviders]);

  // Filter providers based on search query
  const filteredProviders = useMemo(() => {
    if (!providers) return providers;
    if (!searchQuery) return providers;

    return providers
      .map((provider) => ({
        ...provider,
        models: provider.models.filter((model) =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      }))
      .filter((provider) => provider.models.length > 0);
  }, [providers, searchQuery]);

  const handleSelectModel = (providerName: string, modelName: string) => {
    if (isLoading || !hasEditAccess) {
      return;
    }

    setAgent({
      model: {
        provider: providerName,
        model: modelName,
      },
    });
  };

  const isModelSelected = (providerName: string, modelName: string) => {
    return (
      agent.model?.provider === providerName && agent.model?.model === modelName
    );
  };

  return (
    <div className="space-y-2">
      {/* Model Selection */}
      <div className="flex flex-col gap-2">
        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full px-3 py-2 text-sm border rounded-md bg-background",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              (isLoading || !hasEditAccess) && "opacity-60 cursor-not-allowed",
            )}
            disabled={isLoading || !hasEditAccess}
          />
        </div>

        {/* Model list */}
        <div className="overflow-y-auto h-[600px] border rounded-md bg-background">
          {filteredProviders?.length === 0 ? (
            <div className="text-center text-muted-foreground py-2">
              {searchQuery ? t("noResults") : t("noResults")}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {filteredProviders
                ?.filter((p) => p.hasAPIKey)
                .map((provider) => (
                  <div key={provider.provider} className="space-y-2">
                    {/* Provider header */}
                    <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-muted-foreground bg-muted/50 rounded-md">
                      <ModelProviderIcon
                        provider={provider.provider}
                        size={16}
                        colorful={true}
                        className="size-4"
                      />
                      {provider.alias || provider.provider}
                    </div>

                    {/* Model list for this provider */}
                    <div className="space-y-1">
                      {provider.models.map((model) => (
                        <div
                          key={model.name}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                            isModelSelected(provider.provider, model.name)
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-secondary",
                            (isLoading || !hasEditAccess) &&
                              "pointer-events-none opacity-60",
                          )}
                          onClick={() =>
                            handleSelectModel(provider.provider, model.name)
                          }
                        >
                          <ModelProviderIcon
                            provider={provider.provider}
                            size={16}
                            colorful={true}
                            className="size-4 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {model.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {model.type} model
                            </div>
                          </div>
                          {isModelSelected(provider.provider, model.name) && (
                            <CheckIcon className="size-4 text-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
