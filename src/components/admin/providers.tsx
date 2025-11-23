"use client";

import { useState, useMemo, useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ui/table";
import { ModelProviderIcon } from "ui/model-provider-icon";
import { Badge } from "ui/badge";
import { Switch } from "ui/switch";
import { Button } from "ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "ui/alert-dialog";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import type { LLMConfig } from "app-types/provider";
import { cn } from "lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ProviderEditDialog } from "./provider-edit-dialog";
import {
  updateProviderLLMModelsAction,
  deleteProviderAction,
} from "@/app/api/admin/providers/actions";
import { ProviderAddModelDialog } from "./provider-add-model-dialog";

interface ProvidersProps {
  providers: Array<{
    id: number;
    name: string;
    alias: string;
    baseUrl: string;
    apiKey: string | null;
    llm: LLMConfig[] | null;
    updatedAt: Date;
  }>;
  llmMap: Map<string, LLMConfig>;
}

export function Providers({ providers, llmMap }: ProvidersProps) {
  const router = useRouter();
  const t = useTranslations("Admin.Providers");
  const tCommon = useTranslations("Common");
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(
    providers[0]?.id ?? null,
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<
    (Omit<ProvidersProps["providers"][0], "id"> & { id?: number }) | null
  >(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteProvider, setDeleteProvider] = useState<
    ProvidersProps["providers"][0] | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [addModelDialogOpen, setAddModelDialogOpen] = useState(false);
  const [addModelProvider, setAddModelProvider] = useState<
    ProvidersProps["providers"][0] | null
  >(null);
  const [modelToggleOverrides, setModelToggleOverrides] = useState<
    Map<string, boolean>
  >(() => new Map());
  const [modelToggleLoadingKey, setModelToggleLoadingKey] = useState<
    string | null
  >(null);
  const [modelRemovalLoadingKey, setModelRemovalLoadingKey] = useState<
    string | null
  >(null);

  useEffect(() => {
    setModelToggleOverrides(new Map());
    setModelToggleLoadingKey(null);
    setModelRemovalLoadingKey(null);
  }, [providers]);

  const sortedProviders = useMemo(
    () =>
      providers
        .filter(
          (provider, index, self) =>
            self.findIndex((p) => p.name === provider.name) === index,
        )
        .sort((a, b) =>
          a.alias.localeCompare(b.alias, undefined, { sensitivity: "base" }),
        ),
    [providers],
  );

  // Get selected provider
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId),
    [providers, selectedProviderId],
  );

  // Get providers with API keys configured (available providers)
  const availableProviders = useMemo(
    () =>
      providers
        .filter((p) => p.apiKey !== null && p.apiKey !== "")
        .sort((a, b) =>
          a.alias.localeCompare(b.alias, undefined, { sensitivity: "base" }),
        ),
    [providers],
  );

  // Get models for selected provider with full information
  const selectedProviderModels = useMemo(() => {
    if (!selectedProvider || !selectedProvider.llm) {
      return [];
    }

    return selectedProvider.llm.map((llmConfig) => {
      // Use lowercase provider name to match llm table format
      const providerNameLower = selectedProvider.name.toLowerCase();
      const modelKey = `${providerNameLower}:${llmConfig.id}`;
      const fullModelInfo = llmMap.get(modelKey);

      return {
        ...llmConfig,
        fullInfo: fullModelInfo,
      };
    });
  }, [selectedProvider, llmMap]);

  const formatContextLimit = (limit: number | undefined) => {
    if (!limit) return t("modelCard.notAvailable");
    if (limit >= 1024 * 1024) {
      return t("modelCard.contextLimit", {
        limit: `${(limit / (1024 * 1024)).toFixed(1)}M`,
      });
    }
    if (limit >= 1024) {
      return t("modelCard.contextLimit", {
        limit: `${(limit / 1024).toFixed(1)}K`,
      });
    }
    return t("modelCard.contextLimit", { limit: limit.toString() });
  };

  const formatApiKey = (apiKey: string | null): string => {
    if (!apiKey || apiKey.length === 0) {
      return t("apiKeyNotSet");
    }

    // If key is shorter than 12 characters, show full key (likely empty or test value)
    if (apiKey.length < 12) {
      return apiKey;
    }

    // Show first 6 chars, 8 asterisks, last 6 chars
    const prefix = apiKey.slice(0, 6);
    const suffix = apiKey.slice(-6);
    return `${prefix}${"*".repeat(8)}${suffix}`;
  };

  const handleEdit = (
    provider: ProvidersProps["providers"][0],
    e?: React.MouseEvent,
  ) => {
    e?.stopPropagation();
    setEditProvider(provider);
    setEditDialogOpen(true);
  };

  const handleAdd = (
    provider: ProvidersProps["providers"][0],
    e?: React.MouseEvent,
  ) => {
    e?.stopPropagation();
    // Use the selected provider as a template for the new one
    const { id: _omitId, ...rest } = provider;
    setEditProvider({
      ...rest,
      apiKey: "",
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (
    provider: ProvidersProps["providers"][0],
    e?: React.MouseEvent,
  ) => {
    e?.stopPropagation();
    setDeleteProvider(provider);
    setDeleteDialogOpen(true);
  };

  const handleAddModel = (
    provider: ProvidersProps["providers"][0],
    e?: React.MouseEvent,
  ) => {
    e?.stopPropagation();
    setSelectedProviderId(provider.id);
    setAddModelProvider(provider);
    setAddModelDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteProvider) return;

    setIsDeleting(true);

    try {
      await deleteProviderAction(deleteProvider.id);
      toast.success(t("toast.deleted"));
      setDeleteDialogOpen(false);
      setDeleteProvider(null);
      router.refresh();
    } catch (error) {
      toast.error(t("toast.deleteFailed"));
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    router.refresh();
  };

  const handleModelToggle = async (modelId: string, checked: boolean) => {
    if (!selectedProvider || !selectedProvider.llm) {
      return;
    }

    const toggleKey = `${selectedProvider.id}:${modelId}`;
    const previousState =
      selectedProvider.llm.find((model) => model.id === modelId)?.enabled ??
      false;

    setModelToggleOverrides((prev) => {
      const next = new Map(prev);
      next.set(toggleKey, checked);
      return next;
    });
    setModelToggleLoadingKey(toggleKey);

    try {
      const updatedModels = selectedProvider.llm.map((model) =>
        model.id === modelId ? { ...model, enabled: checked } : model,
      );

      // Map minimal model objects to full LLMConfig using llmMap
      const providerNameLower = selectedProvider.name.toLowerCase();
      const persistModels: LLMConfig[] = updatedModels
        .map((model) => {
          const full = llmMap.get(`${providerNameLower}:${model.id}`);
          if (!full) {
            return undefined;
          }
          return {
            ...full,
            enabled: model.enabled,
            temperature: model.temperature,
          } as LLMConfig;
        })
        .filter(Boolean) as LLMConfig[];

      await updateProviderLLMModelsAction(selectedProvider.id, persistModels);
      toast.success(t("toast.updateSuccess"));
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(t("toast.updateFailed"));
      setModelToggleOverrides((prev) => {
        const next = new Map(prev);
        next.set(toggleKey, previousState);
        return next;
      });
    } finally {
      setModelToggleLoadingKey(null);
    }
  };

  const handleModelRemove = async (modelId: string) => {
    if (!selectedProvider || !selectedProvider.llm) {
      return;
    }

    const actionKey = `${selectedProvider.id}:${modelId}`;
    setModelRemovalLoadingKey(actionKey);

    try {
      const updatedModels = selectedProvider.llm.filter(
        (model) => model.id !== modelId,
      );

      // Map minimal model objects to full LLMConfig using llmMap
      const providerNameLower = selectedProvider.name.toLowerCase();
      const persistModels: LLMConfig[] = updatedModels
        .map((model) => {
          const full = llmMap.get(`${providerNameLower}:${model.id}`);
          if (!full) {
            return undefined;
          }
          return {
            ...full,
            enabled: model.enabled,
            temperature: model.temperature,
          } as LLMConfig;
        })
        .filter(Boolean) as LLMConfig[];

      await updateProviderLLMModelsAction(selectedProvider.id, persistModels);
      toast.success(t("toast.updateSuccess"));
      setModelToggleOverrides((prev) => {
        const next = new Map(prev);
        next.delete(actionKey);
        return next;
      });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(t("toast.updateFailed"));
    } finally {
      setModelRemovalLoadingKey(null);
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)] p-6">
      {/* Left Sidebar - Provider List */}
      <div className="w-64 shrink-0">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">{t("listCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto px-0">
            <div className="space-y-2 px-6">
              {sortedProviders.map((provider) => (
                <div key={provider.id} className="group relative">
                  <button
                    onClick={() => setSelectedProviderId(provider.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      "hover:bg-muted/50",
                      selectedProviderId === provider.id
                        ? "bg-muted border-primary"
                        : "bg-card border-border",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <ModelProviderIcon
                        provider={provider.name.toLowerCase()}
                        colorful={Boolean(provider.apiKey?.trim())}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {provider.alias}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {provider.name}
                        </div>
                      </div>
                    </div>
                  </button>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdd(provider, e);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("tooltips.add")}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Side - Content */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        {/* Top Section - Available Providers Table */}
        <Card className="shrink-0">
          <CardHeader>
            <CardTitle className="text-lg">
              {t("availableProvidersTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">
                      {t("tableHeaders.provider")}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {t("tableHeaders.alias")}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {t("tableHeaders.baseUrl")}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {t("tableHeaders.apiKey")}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {t("tableHeaders.updatedAt")}
                    </TableHead>
                    <TableHead className="font-semibold w-[120px]">
                      {t("tableHeaders.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableProviders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {t("noApiProviders")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    availableProviders.map((provider) => (
                      <TableRow
                        key={provider.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50 transition-colors",
                          selectedProviderId === provider.id && "bg-muted/30",
                        )}
                        onClick={() => setSelectedProviderId(provider.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ModelProviderIcon
                              provider={provider.name.toLowerCase()}
                              colorful={Boolean(provider.apiKey?.trim())}
                              className="size-5"
                            />
                            <span className="font-medium">{provider.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {provider.alias}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground font-mono">
                            {provider.baseUrl}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono text-muted-foreground">
                            {formatApiKey(provider.apiKey)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(provider.updatedAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={(e) => handleEdit(provider, e)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("tooltips.edit")}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={(e) => handleAddModel(provider, e)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("tooltips.addModel")}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={(e) => handleDelete(provider, e)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("tooltips.delete")}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Section - Model Information Grid */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedProvider
                ? t("modelSectionTitle", { alias: selectedProvider.alias })
                : t("modelSectionPlaceholder")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {!selectedProvider ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t("selectProviderPrompt")}
              </div>
            ) : selectedProviderModels.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t("noModels")}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {selectedProviderModels.map((model) => (
                  <Card
                    key={model.id}
                    className="relative hover:border-primary/50 transition-colors"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base font-semibold truncate">
                            {model.id}
                          </CardTitle>
                          {model.fullInfo && (
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {model.fullInfo.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatContextLimit(
                                  model.fullInfo.contextLimit,
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 ml-2">
                          {selectedProvider && (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={
                                  modelToggleOverrides.has(
                                    `${selectedProvider.id}:${model.id}`,
                                  )
                                    ? modelToggleOverrides.get(
                                        `${selectedProvider.id}:${model.id}`,
                                      )!
                                    : model.enabled
                                }
                                disabled={
                                  modelToggleLoadingKey ===
                                    `${selectedProvider.id}:${model.id}` ||
                                  modelRemovalLoadingKey ===
                                    `${selectedProvider.id}:${model.id}`
                                }
                                onCheckedChange={(checked) => {
                                  handleModelToggle(model.id, checked);
                                }}
                                aria-label={t("modelCard.toggleAria", {
                                  modelId: model.id,
                                })}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={
                                  modelToggleLoadingKey ===
                                    `${selectedProvider.id}:${model.id}` ||
                                  modelRemovalLoadingKey ===
                                    `${selectedProvider.id}:${model.id}`
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleModelRemove(model.id);
                                }}
                                aria-label={t("tooltips.delete")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm">
                        {model.fullInfo && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {t("modelCard.functionCall")}
                              </span>
                              <Badge
                                variant={
                                  model.fullInfo.functionCall
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {model.fullInfo.functionCall
                                  ? t("modelCard.yes")
                                  : t("modelCard.no")}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {t("modelCard.imageInput")}
                              </span>
                              <Badge
                                variant={
                                  model.fullInfo.imageInput
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {model.fullInfo.imageInput
                                  ? t("modelCard.yes")
                                  : t("modelCard.no")}
                              </Badge>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <ProviderEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        provider={editProvider}
        onSuccess={handleEditSuccess}
      />
      <ProviderAddModelDialog
        open={addModelDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAddModelProvider(null);
          }
          setAddModelDialogOpen(open);
        }}
        provider={addModelProvider}
        onSuccess={() => {
          setAddModelDialogOpen(false);
          setAddModelProvider(null);
          handleEditSuccess();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              {t("dialog.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialog.deleteDescription", {
                alias: deleteProvider?.alias ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tCommon("deleting")}
                </>
              ) : (
                tCommon("delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
