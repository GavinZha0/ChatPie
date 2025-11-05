"use client";

import { appStore } from "@/app/store";
import { useChatModels } from "@/hooks/queries/use-chat-models";
import { ChatModel } from "app-types/chat";
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
}

export const SelectModel = (props: PropsWithChildren<SelectModelProps>) => {
  const [open, setOpen] = useState(false);
  const { data: providers } = useChatModels();
  const [model, setModel] = useState(props.currentModel);

  useEffect(() => {
    const modelToUse = props.currentModel ?? appStore.getState().chatModel;

    if (modelToUse) {
      setModel(modelToUse);
    }
  }, [props.currentModel]);

  const selectedAlias = useMemo(() => {
    if (!model || !providers) return undefined;
    const p = providers.find((x) => x.provider === model.provider);
    return p?.alias || p?.provider;
  }, [model, providers]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {props.children || (
          <Button
            variant={"secondary"}
            size={"sm"}
            className="data-[state=open]:bg-input! hover:bg-input! "
            data-testid="model-selector-button"
          >
            <div className="mr-auto flex items-center gap-1">
              {(props.showProvider ?? true) && (
                <ModelProviderIcon
                  provider={model?.provider || ""}
                  className="size-2.5 mr-1"
                />
              )}
              <p data-testid="selected-model-name">
                {selectedAlias || model?.model || "model"}
              </p>
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
