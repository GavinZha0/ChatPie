"use client";

import { appStore } from "@/app/store";
import { useChatModels } from "@/hooks/queries/use-chat-models";
import { ChatModel } from "app-types/chat";
import { cn } from "lib/utils";
import { CheckIcon, ChevronDown } from "lucide-react";
import {
  Fragment,
  memo,
  PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button } from "ui/button";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "ui/command";
import { ModelProviderIcon } from "ui/model-provider-icon";
import { Popover, PopoverContent, PopoverTrigger } from "ui/popover";

interface SelectModelProps {
  onSelect: (model: ChatModel) => void;
  align?: "start" | "end";
  currentModel?: ChatModel;
  showProvider?: boolean;
  buttonClassName?: string;
  disabled?: boolean; // Disabled prop for agent scenarios
  showAgentModels?: boolean; // Whether to show agent-type models (default: false)
}

export const SelectModel = (props: PropsWithChildren<SelectModelProps>) => {
  const [open, setOpen] = useState(false);
  const { data: allProviders } = useChatModels();

  // Filter providers based on showAgentModels prop
  const providers = useMemo(() => {
    if (!allProviders) return allProviders;

    // If showAgentModels is true, return all providers without filtering
    if (props.showAgentModels) {
      return allProviders;
    }

    // Otherwise, filter out agent-type models
    return allProviders
      .map((provider) => ({
        ...provider,
        // Filter out agent-type models from each provider
        models: provider.models.filter((model) => {
          // Filter out models with type "agent"
          return model.type !== "agent";
        }),
      }))
      .filter((provider) => provider.models.length > 0); // Remove providers with no non-agent models
  }, [allProviders, props.showAgentModels]);

  const [model, setModel] = useState(props.currentModel);

  // Use the disabled prop directly
  const isDisabled = props.disabled;

  useEffect(() => {
    const modelToUse = props.currentModel ?? appStore.getState().chatModel;

    if (modelToUse) {
      setModel(modelToUse);
    }
  }, [props.currentModel]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {props.children || (
          <Button
            variant={"secondary"}
            size={"sm"}
            className={cn(
              "data-[state=open]:bg-input! hover:bg-input!",
              props.buttonClassName,
              isDisabled && "opacity-60 cursor-not-allowed",
            )}
            disabled={isDisabled}
            data-testid="model-selector-button"
          >
            <div className="mr-auto flex items-center gap-1">
              {(props.showProvider ?? true) && (
                <ModelProviderIcon
                  provider={model?.provider || ""}
                  size={16}
                  colorful={true}
                  className="mr-1 size-4 shrink-0"
                />
              )}
              <p data-testid="selected-model-name">{model?.model || "model"}</p>
            </div>
            <ChevronDown className="size-3" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[280px]"
        align={props.align || "end"}
        data-testid="model-selector-popover"
      >
        <Command
          className="rounded-lg relative shadow-md h-80"
          value={JSON.stringify(model)}
          onClick={(e) => e.stopPropagation()}
        >
          <CommandInput
            placeholder="search model..."
            data-testid="model-search-input"
          />
          <CommandList className="p-2">
            <CommandEmpty>No results found.</CommandEmpty>
            {useMemo(() => {
              if (!providers) return null;
              // group providers by alias
              const groups = providers
                .filter((p) => p.hasAPIKey)
                .reduce<
                  Record<
                    string,
                    {
                      alias: string;
                      providerNames: Set<string>;
                      items: {
                        item: (typeof providers)[number]["models"][number];
                        providerName: string;
                      }[];
                      ids: number[];
                    }
                  >
                >((acc, p) => {
                  const key = p.alias || p.provider;
                  if (!acc[key]) {
                    acc[key] = {
                      alias: p.alias || p.provider,
                      providerNames: new Set<string>(),
                      items: [],
                      ids: [],
                    };
                  }
                  acc[key].providerNames.add(p.provider);
                  acc[key].ids.push(p.id ?? Math.random());
                  acc[key].items = acc[key].items.concat(
                    p.models.map((m) => ({
                      item: m,
                      providerName: p.provider,
                    })),
                  );
                  return acc;
                }, {});
              const entries = Object.entries(groups);
              return entries.map(([alias, group], i) => (
                <Fragment key={alias}>
                  <CommandGroup
                    heading={
                      <ProviderHeader
                        providerAlias={group.alias}
                        providerNames={[...group.providerNames]}
                      />
                    }
                    className="pb-4 group"
                    onWheel={(e) => {
                      e.stopPropagation();
                    }}
                    data-testid={`model-provider-alias-${alias}`}
                  >
                    {group.items.map(({ item, providerName }) => (
                      <CommandItem
                        key={`${alias}-${providerName}-${item.name}`}
                        className="cursor-pointer"
                        onSelect={() => {
                          if (isDisabled) return;
                          setModel({
                            provider: providerName,
                            model: item.name,
                          });
                          props.onSelect({
                            provider: providerName,
                            model: item.name,
                          });
                          setOpen(false);
                        }}
                        value={item.name}
                        data-testid={`model-option-${alias}-${providerName}-${item.name}`}
                      >
                        {model &&
                        model.provider === providerName &&
                        model.model === item.name ? (
                          <CheckIcon
                            className="size-3"
                            data-testid="selected-model-check"
                          />
                        ) : (
                          <div className="ml-3" />
                        )}
                        <span className="pr-2">{item.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {i < entries.length - 1 && <CommandSeparator />}
                </Fragment>
              ));
            }, [providers, model])}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const ProviderHeader = memo(function ProviderHeader({
  providerAlias,
  providerNames,
}: { providerAlias: string; providerNames: string[] }) {
  // Determine icon by the first provider name (type key)
  const iconKey = providerNames[0] || "";
  return (
    <div className="text-sm text-muted-foreground flex items-center gap-1.5 group-hover:text-foreground transition-colors duration-300">
      <ModelProviderIcon provider={iconKey} colorful={true} />
      {providerAlias}
    </div>
  );
});
