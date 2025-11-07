"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "ui/dialog";
import {
  MCPServerConfig,
  MCPRemoteConfigZodSchema,
  MCPStdioConfigZodSchema,
} from "app-types/mcp";
import { useTranslations } from "next-intl";
import { useState, useMemo, useEffect } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import { safe } from "ts-safe";
import { createDebounce, fetcher, isNull, safeJSONParse } from "lib/utils";
import { handleErrorWithToast } from "ui/shared-toast";
import { mutate } from "swr";
import { Loader } from "lucide-react";
import {
  isMaybeMCPServerConfig,
  isMaybeRemoteConfig,
} from "lib/ai/mcp/is-mcp-config";
import { Alert, AlertDescription, AlertTitle } from "ui/alert";
import { z } from "zod";
import { existMcpClientByServerNameAction } from "@/app/api/mcp/actions";

interface MCPEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig?: MCPServerConfig;
  name?: string;
  id?: string;
}

const STDIO_ARGS_ENV_PLACEHOLDER = `/** STDIO Example */
{
  "command": "node", 
  "args": ["index.js"],
  "env": {
    "OPENAI_API_KEY": "sk-...",
  }
}


/** SSE,Streamable HTTP Example */
{
  "url": "https://api.example.com",
  "headers": {
    "Authorization": "Bearer sk-..."
  }
}`;

function MCPEditor({
  initialConfig,
  name: initialName,
  id,
  onSaveSuccess,
}: {
  initialConfig?: MCPServerConfig;
  name?: string;
  id?: string;
  onSaveSuccess?: () => void;
}) {
  const t = useTranslations();
  const shouldInsert = useMemo(() => isNull(id), [id]);

  const [isLoading, setIsLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const errorDebounce = useMemo(() => createDebounce(), []);

  // State for form fields
  const [name, setName] = useState<string>(initialName ?? "");
  const [config, setConfig] = useState<MCPServerConfig>(
    initialConfig as MCPServerConfig,
  );
  const [jsonString, setJsonString] = useState<string>(
    initialConfig ? JSON.stringify(initialConfig, null, 2) : "",
  );

  useEffect(() => {
    setName(initialName ?? "");
    setConfig(initialConfig as MCPServerConfig);
    setJsonString(initialConfig ? JSON.stringify(initialConfig, null, 2) : "");
  }, [initialName, initialConfig]);

  // Name validation schema
  const nameSchema = z.string().regex(/^[a-zA-Z0-9\-]+$/, {
    message: t("MCP.nameMustContainOnlyAlphanumericCharactersAndHyphens"),
  });

  const validateName = (nameValue: string): boolean => {
    const result = nameSchema.safeParse(nameValue);
    if (!result.success) {
      setNameError(
        t("MCP.nameMustContainOnlyAlphanumericCharactersAndHyphens"),
      );
      return false;
    }
    setNameError(null);
    return true;
  };

  const saveDisabled = useMemo(() => {
    return (
      name.trim() === "" ||
      isLoading ||
      !!jsonError ||
      !!nameError ||
      !isMaybeMCPServerConfig(config)
    );
  }, [isLoading, jsonError, nameError, config, name]);

  // Validate
  const validateConfig = (jsonConfig: unknown): boolean => {
    const result = isMaybeRemoteConfig(jsonConfig)
      ? MCPRemoteConfigZodSchema.safeParse(jsonConfig)
      : MCPStdioConfigZodSchema.safeParse(jsonConfig);
    if (!result.success) {
      handleErrorWithToast(result.error, "mcp-editor-error");
    }
    return result.success;
  };

  // Handle save button click
  const handleSave = async () => {
    // Perform validation
    if (!validateConfig(config)) return;
    if (!name) {
      return handleErrorWithToast(
        new Error(t("MCP.nameIsRequired")),
        "mcp-editor-error",
      );
    }

    if (!validateName(name)) {
      return handleErrorWithToast(
        new Error(t("MCP.nameMustContainOnlyAlphanumericCharactersAndHyphens")),
        "mcp-editor-error",
      );
    }

    safe(() => setIsLoading(true))
      .map(async () => {
        if (shouldInsert) {
          const exist = await existMcpClientByServerNameAction(name);
          if (exist) {
            throw new Error(t("MCP.nameAlreadyExists"));
          }
        }
      })
      .map(() =>
        fetcher("/api/mcp", {
          method: "POST",
          body: JSON.stringify({
            name,
            config,
            id,
          }),
        }),
      )
      .ifOk(() => {
        toast.success(t("MCP.configurationSavedSuccessfully"));
        mutate("/api/mcp/list");
        onSaveSuccess?.();
      })
      .ifFail(handleErrorWithToast)
      .watch(() => setIsLoading(false));
  };

  const handleConfigChange = (data: string) => {
    setJsonString(data);
    const result = safeJSONParse(data);
    errorDebounce.clear();
    if (result.success) {
      setConfig(result.value as MCPServerConfig);
      setJsonError(null);
    } else if (data.trim() !== "") {
      errorDebounce(() => {
        setJsonError(
          (result.error as Error)?.message ??
            JSON.stringify(result.error, null, 2),
        );
      }, 1000);
    }
  };

  return (
    <>
      <div className="flex flex-col space-y-6">
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>

          <Input
            id="name"
            value={name}
            disabled={isLoading}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value) validateName(e.target.value);
            }}
            placeholder={t("MCP.enterMcpServerName")}
            className={nameError ? "border-destructive" : ""}
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="config">Config</Label>
          <Textarea
            id="config-editor"
            value={jsonString}
            onChange={(e) => handleConfigChange(e.target.value)}
            data-testid="mcp-config-editor"
            className="font-mono h-[30vh] resize-none overflow-y-auto"
            placeholder={STDIO_ARGS_ENV_PLACEHOLDER}
          />
          {jsonError && jsonString && (
            <div className="w-full pt-2 animate-in fade-in-0 duration-300">
              <Alert variant="destructive" className="border-destructive">
                <AlertTitle className="text-xs font-semibold">
                  Parsing Error
                </AlertTitle>
                <AlertDescription className="text-xs">
                  {jsonError}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Save button */}
        <Button onClick={handleSave} className="w-full" disabled={saveDisabled}>
          {isLoading ? (
            <Loader className="size-4 animate-spin" />
          ) : (
            <span className="font-bold">{t("MCP.saveConfiguration")}</span>
          )}
        </Button>
      </div>
    </>
  );
}

export function MCPEditorDialog({
  open,
  onOpenChange,
  initialConfig,
  name,
  id,
}: MCPEditorDialogProps) {
  const t = useTranslations("MCP");
  const isCreating = !id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? t("addMcpServer") : t("editMcpServer")}
          </DialogTitle>
        </DialogHeader>
        <MCPEditor
          initialConfig={initialConfig}
          name={name}
          id={id}
          onSaveSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
