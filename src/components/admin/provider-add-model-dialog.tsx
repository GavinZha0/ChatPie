"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { Label } from "ui/label";
import { Input } from "ui/input";
import { Button } from "ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ui/select";
import { Switch } from "ui/switch";
import { Loader2 } from "lucide-react";
import type { LlmModel, LlmModelType } from "app-types/llm";
import type { LLMConfig } from "app-types/provider";
import { saveLlmAction } from "@/app/api/llm/actions";
import { updateProviderLLMModelsAction } from "@/app/api/provider/actions";

interface ProviderWithModels {
  id: number;
  name: string;
  alias: string;
  baseUrl: string;
  apiKey: string | null;
  llm: LLMConfig[] | null;
  updatedAt: Date;
}

interface ProviderAddModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderWithModels | null;
  llmMap: Map<string, LlmModel>;
  onSuccess?: () => void;
}

const MODEL_TYPE_OPTIONS: Array<{ value: LlmModelType; labelKey: string }> = [
  { value: "chat", labelKey: "modelTypes.chat" },
  { value: "vision", labelKey: "modelTypes.vision" },
  { value: "embedding", labelKey: "modelTypes.embedding" },
  { value: "audio", labelKey: "modelTypes.audio" },
  { value: "transcription", labelKey: "modelTypes.transcription" },
  { value: "rerank", labelKey: "modelTypes.rerank" },
];

const NEW_MODEL_VALUE = "__create_new_model__";
const DEFAULT_CONTEXT_LIMIT = "81920";

export function ProviderAddModelDialog({
  open,
  onOpenChange,
  provider,
  llmMap,
  onSuccess,
}: ProviderAddModelDialogProps) {
  const t = useTranslations("Admin.Providers");
  const tCommon = useTranslations("Common");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newModelId, setNewModelId] = useState("");
  const [modelType, setModelType] = useState<LlmModelType>(
    MODEL_TYPE_OPTIONS[0]!.value,
  );
  const [supportsFunctionCall, setSupportsFunctionCall] = useState(false);
  const [supportsImageInput, setSupportsImageInput] = useState(false);
  const [contextLimit, setContextLimit] = useState<string>(
    DEFAULT_CONTEXT_LIMIT,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableModels = useMemo(() => {
    if (!provider) {
      return [];
    }

    const providerKey = provider.name.toLowerCase();
    const attachedModelIds = new Set(
      (provider.llm ?? []).map((model) => model.id),
    );
    const models: LlmModel[] = [];

    llmMap.forEach((model) => {
      if (
        model.provider.toLowerCase() === providerKey &&
        !attachedModelIds.has(model.id)
      ) {
        models.push(model);
      }
    });

    return models.sort((a, b) => a.id.localeCompare(b.id));
  }, [provider, llmMap]);

  useEffect(() => {
    if (!open) {
      setSelectedModel(null);
      setIsCreatingNew(false);
      setNewModelId("");
      setModelType(MODEL_TYPE_OPTIONS[0]!.value);
      setSupportsFunctionCall(false);
      setSupportsImageInput(false);
      setContextLimit(DEFAULT_CONTEXT_LIMIT);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !provider) {
      return;
    }

    if (!isCreatingNew && selectedModel) {
      const existing = availableModels.find(
        (model) => model.id === selectedModel,
      );

      if (existing) {
        setModelType(existing.type);
        setSupportsFunctionCall(existing.functionCall ?? false);
        setSupportsImageInput(existing.imageInput ?? false);
        setContextLimit(
          existing.contextLimit ? existing.contextLimit.toString() : "",
        );
      }
    }
  }, [open, provider, selectedModel, isCreatingNew, availableModels]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (availableModels.length === 0) {
      setIsCreatingNew(true);
      setSelectedModel(null);
      setModelType(MODEL_TYPE_OPTIONS[0]!.value);
      setSupportsFunctionCall(false);
      setSupportsImageInput(false);
      setContextLimit(DEFAULT_CONTEXT_LIMIT);
      return;
    }

    if (!isCreatingNew && !selectedModel) {
      const firstModel = availableModels[0];
      setSelectedModel(firstModel.id);
      setModelType(firstModel.type);
      setSupportsFunctionCall(firstModel.functionCall ?? false);
      setSupportsImageInput(firstModel.imageInput ?? false);
      setContextLimit(
        firstModel.contextLimit ? firstModel.contextLimit.toString() : "",
      );
    }
  }, [open, availableModels, isCreatingNew, selectedModel]);

  const handleModelSelection = (value: string) => {
    if (value === NEW_MODEL_VALUE) {
      setSelectedModel(null);
      setIsCreatingNew(true);
      setNewModelId("");
      setModelType(MODEL_TYPE_OPTIONS[0]!.value);
      setSupportsFunctionCall(false);
      setSupportsImageInput(false);
      setContextLimit(DEFAULT_CONTEXT_LIMIT);
      return;
    }

    setSelectedModel(value);
    setIsCreatingNew(false);
    const existing = availableModels.find((model) => model.id === value);

    if (existing) {
      setModelType(existing.type);
      setSupportsFunctionCall(existing.functionCall ?? false);
      setSupportsImageInput(existing.imageInput ?? false);
      setContextLimit(
        existing.contextLimit ? existing.contextLimit.toString() : "",
      );
    }
  };

  const handleSubmit = async () => {
    if (!provider) {
      return;
    }

    const providerModels = provider.llm ?? [];

    const modelId = isCreatingNew ? newModelId.trim() : selectedModel;

    if (!modelId || modelId.length === 0) {
      toast.error(t("addModelDialog.modelIdRequired"));
      return;
    }

    const parsedContextLimit =
      contextLimit.trim() === "" ? undefined : Number(contextLimit);

    if (
      parsedContextLimit !== undefined &&
      (Number.isNaN(parsedContextLimit) || parsedContextLimit < 0)
    ) {
      toast.error(t("addModelDialog.contextLimitInvalid"));
      return;
    }

    if (providerModels.some((model) => model.id === modelId)) {
      toast.error(t("addModelDialog.modelAlreadyExists"));
      return;
    }

    setIsSubmitting(true);

    try {
      if (isCreatingNew) {
        await saveLlmAction({
          id: modelId,
          provider: provider.name.toLowerCase(),
          type: modelType,
          functionCall: supportsFunctionCall,
          imageInput: supportsImageInput,
          contextLimit: parsedContextLimit,
        });
      }

      // enable the model by default
      const updatedModels: LLMConfig[] = [
        ...providerModels,
        {
          id: modelId,
          enabled: true,
        },
      ];

      await updateProviderLLMModelsAction(provider.id, updatedModels);

      toast.success(t("toast.addModelSuccess"));
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(t("toast.addModelFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!provider) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{provider.alias}</DialogTitle>
          <DialogDescription>
            {t("addModelDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-3">
            <Label
              htmlFor="provider-model-select"
              className="w-32 shrink-0 text-sm font-medium text-muted-foreground"
            >
              {t("addModelDialog.selectModelLabel")}
            </Label>
            <Select
              onValueChange={handleModelSelection}
              disabled={isSubmitting}
              value={isCreatingNew ? NEW_MODEL_VALUE : (selectedModel ?? "")}
            >
              <SelectTrigger id="provider-model-select" className="flex-1">
                <SelectValue
                  placeholder={t("addModelDialog.selectModelPlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.id}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_MODEL_VALUE}>
                  {t("addModelDialog.createNewOption")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCreatingNew && (
            <div className="flex items-center gap-3">
              <Label
                htmlFor="provider-model-id"
                className="w-32 shrink-0 text-sm font-medium text-muted-foreground"
              >
                {t("addModelDialog.newModelIdLabel")}
              </Label>
              <Input
                id="provider-model-id"
                value={newModelId}
                onChange={(event) => setNewModelId(event.target.value)}
                disabled={isSubmitting}
                placeholder={t("addModelDialog.newModelIdPlaceholder")}
                className="flex-1"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Label
              htmlFor="provider-model-type"
              className="w-32 shrink-0 text-sm font-medium text-muted-foreground"
            >
              {t("addModelDialog.modelTypeLabel")}
            </Label>
            <Select
              value={modelType}
              onValueChange={(value) => setModelType(value as LlmModelType)}
              disabled={!isCreatingNew || isSubmitting}
            >
              <SelectTrigger id="provider-model-type" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {t("addModelDialog.functionCallLabel")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("addModelDialog.functionCallHelper")}
              </span>
            </div>
            <Switch
              checked={supportsFunctionCall}
              onCheckedChange={setSupportsFunctionCall}
              disabled={!isCreatingNew || isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {t("addModelDialog.imageInputLabel")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("addModelDialog.imageInputHelper")}
              </span>
            </div>
            <Switch
              checked={supportsImageInput}
              onCheckedChange={setSupportsImageInput}
              disabled={!isCreatingNew || isSubmitting}
            />
          </div>

          <div className="flex items-center gap-3">
            <Label
              htmlFor="provider-context-limit"
              className="w-32 shrink-0 text-sm font-medium text-muted-foreground"
            >
              {t("addModelDialog.contextLimitLabel")}
            </Label>
            <Input
              id="provider-context-limit"
              type="number"
              min={0}
              value={contextLimit}
              onChange={(event) => setContextLimit(event.target.value)}
              disabled={!isCreatingNew || isSubmitting}
              placeholder={t("addModelDialog.contextLimitPlaceholder")}
              className="flex-1"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isSubmitting}>
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tCommon("saving")}
              </>
            ) : (
              tCommon("save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
