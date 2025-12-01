"use client";

import { authClient } from "auth/client";
import { useEffect, useState } from "react";
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
import { Agent } from "app-types/agent";
import type { LLMConfig, LlmType } from "app-types/provider";

import { updateProviderLLMModelsAction } from "@/app/api/admin/providers/actions";
import { fetcher } from "@/lib/utils";
import { AgentCreateSchema } from "app-types/agent";

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
  onSuccess?: () => void;
}

const MODEL_TYPE_OPTIONS: Array<{ value: LlmType; labelKey: string }> = [
  { value: "chat", labelKey: "modelTypes.chat" },
  { value: "vision", labelKey: "modelTypes.vision" },
  { value: "audio", labelKey: "modelTypes.audio" },
  { value: "agent", labelKey: "modelTypes.agent" },
];

const DEFAULT_CONTEXT_LIMIT = "81920";

export function ProviderAddModelDialog({
  open,
  onOpenChange,
  provider,
  onSuccess,
}: ProviderAddModelDialogProps) {
  const t = useTranslations("Admin.Providers");
  const tCommon = useTranslations("Common");
  const [modelId, setModelId] = useState("");
  const [modelType, setModelType] = useState<LlmType>(
    MODEL_TYPE_OPTIONS[0]!.value,
  );
  const [description, setDescription] = useState("");
  const [supportsFunctionCall, setSupportsFunctionCall] = useState(false);
  const [supportsImageInput, setSupportsImageInput] = useState(false);
  const [contextLimit, setContextLimit] = useState<string>(
    DEFAULT_CONTEXT_LIMIT,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (!open) {
      setModelId("");
      setModelType(MODEL_TYPE_OPTIONS[0]!.value);
      setSupportsFunctionCall(true);
      setSupportsImageInput(false);
      setContextLimit(DEFAULT_CONTEXT_LIMIT);
      setDescription("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!provider) {
      return;
    }

    const providerModels = provider.llm ?? [];

    const finalModelId = modelId.trim();

    if (!finalModelId || finalModelId.length === 0) {
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

    if (providerModels.some((model) => model.id === finalModelId)) {
      toast.error(t("addModelDialog.modelAlreadyExists"));
      return;
    }

    setIsSubmitting(true);

    try {
      if (modelType === "agent") {
        if (!session?.user.id) {
          toast.error("User not authenticated");
          return;
        }

        const agents = (await fetcher("/api/agent")) as Agent[];
        const agentExists = agents.some((agent) => agent.name === finalModelId);

        if (agentExists) {
          toast.error(
            "An agent with this name already exists. Please create it manually on the agent creation page.",
          );
        } else {
          const agentData = {
            name: finalModelId,
            description: description.trim(),
            model: {
              provider: provider.name.toLowerCase(),
              model: finalModelId,
            },
            icon: {
              type: "emoji",
              value: "1f916",
              style: {
                backgroundColor: "oklch(87% 0 0)",
              },
            },
            userId: session.user.id,
          };

          await fetcher("/api/agent", {
            method: "POST",
            body: JSON.stringify(AgentCreateSchema.parse(agentData)),
          });
        }
      }

      // append full model configuration to provider.llm
      const newModelConfig: LLMConfig = {
        id: finalModelId,
        enabled: true,
        type: modelType,
        functionCall: supportsFunctionCall,
        imageInput: supportsImageInput,
        contextLimit: parsedContextLimit ?? Number(DEFAULT_CONTEXT_LIMIT),
        description: description.trim() || undefined,
      };

      const updatedModels: LLMConfig[] = [...providerModels, newModelConfig];

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
          <div className="flex items-center">
            <Label
              htmlFor="provider-model-id"
              className="w-24 shrink-0 text-sm font-medium text-muted-foreground"
            >
              {t("addModelDialog.newModelIdLabel")}
            </Label>
            <Input
              id="provider-model-id"
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              disabled={isSubmitting}
              placeholder={t("addModelDialog.newModelIdPlaceholder")}
              className="flex-1"
            />
          </div>

          <div className="flex items-center">
            <Label
              htmlFor="provider-model-type"
              className="w-24 shrink-0 text-sm font-medium text-muted-foreground"
            >
              {t("addModelDialog.modelTypeLabel")}
            </Label>
            <Select
              value={modelType}
              onValueChange={(value) => setModelType(value as LlmType)}
              disabled={isSubmitting}
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

          <div className="flex items-center">
            <Label
              htmlFor="provider-model-description"
              className="w-24 shrink-0 text-sm font-medium text-muted-foreground"
            >
              {t("addModelDialog.modelDescriptionLabel")}
            </Label>
            <Input
              id="provider-model-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              placeholder={t("addModelDialog.modelDescriptionPlaceholder")}
              className="flex-1"
            />
          </div>

          <div className="flex items-center justify-between">
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
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between">
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
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center">
            <Label
              htmlFor="provider-context-limit"
              className="w-24 shrink-0 text-sm font-medium text-muted-foreground"
            >
              {t("addModelDialog.contextLimitLabel")}
            </Label>
            <Input
              id="provider-context-limit"
              type="number"
              min={0}
              value={contextLimit}
              onChange={(event) => setContextLimit(event.target.value)}
              disabled={isSubmitting}
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
