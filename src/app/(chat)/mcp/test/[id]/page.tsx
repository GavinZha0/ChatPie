"use client";

import {
  callMcpToolAction,
  selectMcpClientAction,
} from "@/app/api/mcp/actions";
import {
  ChevronDown,
  ChevronUp,
  Loader,
  Search,
  WandSparkles,
} from "lucide-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  PropsWithChildren,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { Input } from "ui/input";
import { Separator } from "ui/separator";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "ui/resizable";
import { Skeleton } from "ui/skeleton";
import { Button } from "ui/button";
import { Textarea } from "ui/textarea";
import JsonView from "@/components/ui/json-view";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "ui/alert";
import { safeJSONParse, isNull, isString } from "lib/utils";
import { withTheme } from "@rjsf/core";
import { Theme as shadcnTheme } from "@rjsf/shadcn";
import validator from "@rjsf/validator-ajv8";
import type { FieldTemplateProps, FieldProps } from "@rjsf/utils";

const Form = withTheme(shadcnTheme);

/** Custom FieldTemplate: renders the required asterisk in red */
function CustomFieldTemplate(props: FieldTemplateProps) {
  const {
    id,
    label,
    required,
    displayLabel,
    rawErrors = [],
    errors,
    help,
    description,
    rawDescription,
    children,
    uiSchema,
  } = props;

  const isCheckbox = uiSchema?.["ui:widget"] === "checkbox";
  const hasError = rawErrors.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {displayLabel && !isCheckbox && (
        <label
          htmlFor={id}
          className={[
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            hasError ? " text-destructive" : "",
          ].join(" ")}
        >
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}
      {children}
      {displayLabel && rawDescription && !isCheckbox && (
        <span
          className={[
            "text-xs font-medium text-muted-foreground",
            hasError ? " text-destructive" : "",
          ].join(" ")}
        >
          {description}
        </span>
      )}
      {errors}
      {help}
    </div>
  );
}

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "ui/dialog";

import { handleErrorWithToast } from "ui/shared-toast";
import { generateExampleToolSchemaAction } from "@/app/api/chat/actions";
import { appStore } from "@/app/store";
import { MCPToolInfo } from "app-types/mcp";
import { Label } from "ui/label";
import { safe } from "ts-safe";
import { useObjectState } from "@/hooks/use-object-state";
import { useTranslations } from "next-intl";
import { ChatModel } from "app-types/chat";
import { SelectModel } from "@/components/select-model";

// Type definitions
type ToolInfo = {
  name: string;
  description: string;
  inputSchema?: any;
};

type CallResult = {
  success: boolean;
  data?: any;
  error?: string;
};

// Tool list item component
const ToolListItem = ({
  tool,
  isSelected,
  onClick,
}: {
  tool: ToolInfo;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <div
    className={`flex border-secondary border cursor-pointer rounded-md p-2 transition-colors ${
      isSelected ? "bg-secondary" : "hover:bg-secondary"
    }`}
    onClick={onClick}
  >
    <div className="flex-1 w-full">
      <p className="font-medium text-sm mb-1 truncate">{tool.name}</p>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {tool.description}
      </p>
    </div>
  </div>
);

// Description display component
const ToolDescription = ({
  description,
  showFullDescription,
  toggleDescription,
}: {
  description: string;
  showFullDescription: boolean;
  toggleDescription: () => void;
}) => (
  <div className="mb-2">
    <p className="text-sm text-muted-foreground">
      {showFullDescription
        ? description
        : `${description.slice(0, 300)}${description.length > 300 ? "..." : ""}`}
    </p>
    {description.length > 300 && (
      <Button
        variant="ghost"
        className="ml-auto p-0 h-6 mt-1 text-xs text-muted-foreground hover:text-foreground flex items-center"
        onClick={toggleDescription}
      >
        {showFullDescription ? (
          <>
            Show less
            <ChevronUp className="ml-1 h-3 w-3" />
          </>
        ) : (
          <>
            Show more
            <ChevronDown className="ml-1 h-3 w-3" />
          </>
        )}
      </Button>
    )}
  </div>
);

type GenerateExampleInputJsonDialogProps = {
  toolInfo: MCPToolInfo;
  onGenerated: (json: string) => void;
};

const GenerateExampleInputJsonDialog = ({
  toolInfo,
  children,
  onGenerated,
}: PropsWithChildren<GenerateExampleInputJsonDialogProps>) => {
  const currentModelName = appStore((state) => state.chatModel);
  const t = useTranslations();

  const [option, setOption] = useObjectState({
    open: false,
    model: currentModelName,
    prompt: "",
    loading: false,
  });

  const generateExampleSchema = useCallback(() => {
    safe(() => setOption({ loading: true }))
      .map(() =>
        generateExampleToolSchemaAction({
          model: option.model,
          toolInfo: toolInfo,
          prompt: option.prompt,
        }),
      )
      .ifOk((result) => {
        onGenerated(JSON.stringify(result, null, 2));
      })
      .watch(() => {
        setOption({
          loading: false,
          prompt: "",
          model: currentModelName,
          open: false,
        });
      })
      .ifFail(handleErrorWithToast);
  }, [option, toolInfo, currentModelName, onGenerated]);

  return (
    <Dialog open={option.open} onOpenChange={(open) => setOption({ open })}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <p>{t("MCP.generateExampleInputJSON")}</p>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("MCP.enterPromptToGenerateExampleInputJSON")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <div className="flex items-center gap-2">
            <Label className="shrink-0">{t("MCP.model")}</Label>
            <div className="flex-1">
              <SelectModel
                modelTypes={["chat"]}
                currentModel={option.model as ChatModel}
                onSelect={(model) => setOption({ model })}
                buttonClassName="w-full"
              />
            </div>
          </div>
          <div />
          <Label>
            {t("MCP.prompt")}{" "}
            <span className="text-muted-foreground text-xs">
              {"("}
              {t("Common.optional")}
              {")"}
            </span>
          </Label>

          <Textarea
            disabled={option.loading}
            className="resize-none h-28 placeholder:text-xs"
            value={option.prompt}
            onChange={(e) => setOption({ prompt: e.target.value })}
            placeholder={t("MCP.enterPromptToGenerateExampleInputJSON")}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">{t("Common.cancel")}</Button>
          </DialogClose>

          <Button variant="default" onClick={generateExampleSchema}>
            {option.loading ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              t("Common.generate")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const generateUiSchema = (schema: any): any => {
  if (!schema || typeof schema !== "object") return {};

  if (schema.type === "object") {
    if (!schema.properties || Object.keys(schema.properties).length === 0) {
      return { "ui:field": "json" };
    }
    const uiSchema: any = {};
    for (const [key, propSchema] of Object.entries(schema.properties) as [
      string,
      any,
    ]) {
      const fieldUiSchema = generateUiSchema(propSchema);
      if (Object.keys(fieldUiSchema).length > 0) {
        uiSchema[key] = fieldUiSchema;
      }
    }
    return uiSchema;
  } else if (schema.type === "array" && schema.items) {
    const itemsUiSchema = generateUiSchema(schema.items);
    if (Object.keys(itemsUiSchema).length > 0) {
      return { items: itemsUiSchema };
    }
  }
  return {};
};

function JsonField(props: FieldProps) {
  const { formData, onChange, idSchema, schema, name, required } = props;

  const [text, setText] = useState(
    formData ? JSON.stringify(formData, null, 2) : "{}",
  );
  const [error, setError] = useState<string | null>(null);

  const lastFormDataRef = useRef(formData);

  useEffect(() => {
    if (JSON.stringify(formData) !== JSON.stringify(lastFormDataRef.current)) {
      lastFormDataRef.current = formData;
      setText(formData ? JSON.stringify(formData, null, 2) : "{}");
      setError(null);
    }
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    try {
      if (val.trim() === "") {
        setError(null);
        lastFormDataRef.current = undefined;
        (onChange as any)(undefined);
        return;
      }
      const parsed = JSON.parse(val);
      setError(null);
      lastFormDataRef.current = parsed;
      (onChange as any)(parsed);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full mt-1 mb-2">
      {(schema.title || name) && (
        <label
          htmlFor={idSchema?.$id || name}
          className={[
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            error ? " text-destructive" : "",
          ].join(" ")}
        >
          {schema.title || name}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}
      <Textarea
        id={idSchema?.$id || name}
        className="font-mono text-xs h-[180px] resize-none"
        value={text}
        onChange={handleChange}
        onBlur={() => {
          try {
            if (text.trim() === "") {
              (onChange as any)(undefined);
              setText("{}");
            } else {
              const parsed = JSON.parse(text);
              setText(JSON.stringify(parsed, null, 2));
            }
          } catch {}
        }}
      />
      {schema.description && (
        <span
          className={[
            "text-xs font-medium text-muted-foreground",
            error ? " text-destructive" : "",
          ].join(" ")}
        >
          {schema.description}
        </span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export default function Page() {
  const { id } = useParams() as { id: string };

  const t = useTranslations();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedToolIndex, setSelectedToolIndex] = useState<number>(0);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Tool testing state
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<CallResult | null>(null);
  const [isCallLoading, setIsCallLoading] = useState(false);

  const { data: client, isLoading } = useSWR(`/mcp/${id}`, () =>
    selectMcpClientAction(id as string),
  );

  const filteredTools = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    return (
      client?.toolInfo?.filter(
        (tool) =>
          tool.name.toLowerCase().includes(trimmedQuery) ||
          tool.description.toLowerCase().includes(trimmedQuery),
      ) || []
    );
  }, [client?.toolInfo, searchQuery]);

  const selectedTool = useMemo(() => {
    return filteredTools?.[selectedToolIndex];
  }, [filteredTools, selectedToolIndex]);

  const uiSchema = useMemo(() => {
    return generateUiSchema(selectedTool?.inputSchema);
  }, [selectedTool?.inputSchema]);

  const toggleDescription = () => setShowFullDescription(!showFullDescription);

  const formDataRef = useMemo(() => {
    if (!jsonInput) return {};
    const parsed = safeJSONParse(jsonInput);
    return parsed.success ? parsed.value : {};
  }, [jsonInput]);

  const handleInputChange = (data: string) => {
    setJsonInput(data);
    if (data.trim() === "") {
      setJsonError(null);
      return;
    }

    const result = safeJSONParse(data);
    if (!result.success) {
      setJsonError(
        (result.error as Error)?.message ??
          JSON.stringify(result.error, null, 2),
      );
    } else {
      setJsonError(null);
    }
  };

  const handleToolCall = async () => {
    if (!selectedTool) return;

    const parsedInput = safeJSONParse(jsonInput || "{}");
    if (!parsedInput.success)
      return handleErrorWithToast(parsedInput.error as Error);

    setIsCallLoading(true);
    try {
      const result = await callMcpToolAction(
        id,
        selectedTool.name,
        parsedInput.value,
      );

      setCallResult({
        success: true,
        data: result,
      });
    } catch (error) {
      setCallResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsCallLoading(false);
    }
  };

  // Skeleton loader for tool list
  const renderSkeletons = () => (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="w-full h-14" />
      ))}
    </>
  );

  // Empty state message
  const renderEmptyState = () => (
    <p className="text-sm text-muted-foreground text-center py-4">
      {client?.toolInfo?.length
        ? t("Common.noResults")
        : t("MCP.noToolsAvailable")}
    </p>
  );

  useEffect(() => {
    setCallResult(null);
    setIsCallLoading(false);
    setJsonError(null);
    setJsonInput("");
    setShowFullDescription(false);
  }, [selectedToolIndex]);

  useEffect(() => {
    setSelectedToolIndex(0);
  }, [searchQuery]);

  return (
    <div className="relative flex flex-col px-4 w-full h-full py-2">
      <div className="bg-background">
        <header>
          <h2 className="text-2xl font-semibold">
            {decodeURIComponent(client?.name ?? "")}
          </h2>
        </header>
      </div>

      <ResizablePanelGroup
        direction="horizontal"
        className="mt-2 flex-1 min-h-0"
      >
        {/* Tool List Panel */}
        <ResizablePanel defaultSize={25}>
          <div className="w-full flex flex-col h-full relative pr-8">
            <div className="top-0 pb-2 z-1">
              <div className="w-full relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t("MCP.searchTools")}
                  className="pl-8 bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 h-full overflow-y-auto no-scrollbar">
              {isLoading
                ? renderSkeletons()
                : filteredTools.length > 0
                  ? filteredTools.map((tool, index) => (
                      <ToolListItem
                        key={tool.name}
                        tool={tool}
                        isSelected={selectedToolIndex === index}
                        onClick={() => setSelectedToolIndex(index)}
                      />
                    ))
                  : renderEmptyState()}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Tool Detail Panel */}
        <ResizablePanel defaultSize={75}>
          <div className="w-full h-full flex flex-col min-h-0">
            {selectedTool ? (
              <div className="flex-1 flex flex-col pl-4 pr-4 min-h-0 overflow-hidden">
                <div className="sticky top-0 bg-background">
                  <h3 className="text-xl font-medium flex items-center gap-2">
                    {selectedTool.name}
                  </h3>

                  {selectedTool.description && (
                    <ToolDescription
                      description={selectedTool.description}
                      showFullDescription={showFullDescription}
                      toggleDescription={toggleDescription}
                    />
                  )}

                  <Separator className="my-2" />
                </div>

                <div className="flex-1 min-h-0 grid grid-cols-2 gap-2">
                  {selectedTool.inputSchema ? (
                    <>
                      {/* Left column: single tab group with Form / JSON Input / JSON Schema */}
                      <div className="flex flex-col min-h-0">
                        <div className="flex-1 min-h-0 flex flex-col">
                          <Tabs
                            defaultValue="form"
                            className="flex-1 min-h-0 border border-input rounded-md overflow-hidden flex flex-col"
                          >
                            <div className="bg-muted/60 border-b border-input px-1.5 py-1 flex justify-between items-center">
                              <TabsList className="bg-transparent p-0">
                                <TabsTrigger value="form" className="px-2 py-1">
                                  {t("MCP.formInput") || "Form Input"}
                                </TabsTrigger>
                                <TabsTrigger value="json" className="px-2 py-1">
                                  {t("MCP.inputJSON") || "JSON Input"}
                                </TabsTrigger>
                                <TabsTrigger
                                  value="schema"
                                  className="px-2 py-1"
                                >
                                  {t("MCP.jsonSchema") || "JSON Schema"}
                                </TabsTrigger>
                              </TabsList>

                              <GenerateExampleInputJsonDialog
                                toolInfo={selectedTool}
                                onGenerated={(json) => setJsonInput(json)}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent"
                                >
                                  {t("MCP.createInputWithAI")}
                                  <WandSparkles className="ml-1 size-3" />
                                </Button>
                              </GenerateExampleInputJsonDialog>
                            </div>

                            <div className="flex-1 min-h-0 p-4 flex flex-col overflow-y-auto">
                              <TabsContent
                                value="form"
                                className="h-full m-0 min-h-0 flex flex-col"
                              >
                                <Form
                                  schema={
                                    (selectedTool.inputSchema as Record<
                                      string,
                                      any
                                    >) || {}
                                  }
                                  uiSchema={uiSchema}
                                  validator={validator}
                                  formData={formDataRef}
                                  onChange={(e) =>
                                    handleInputChange(
                                      JSON.stringify(e.formData, null, 2),
                                    )
                                  }
                                  templates={{
                                    FieldTemplate: CustomFieldTemplate,
                                  }}
                                  fields={{
                                    json: JsonField,
                                  }}
                                >
                                  <></>
                                </Form>
                              </TabsContent>
                              <TabsContent
                                value="json"
                                className="h-full m-0 min-h-0 flex flex-col"
                              >
                                <Textarea
                                  autoFocus
                                  value={jsonInput}
                                  onChange={(e) =>
                                    handleInputChange(e.target.value)
                                  }
                                  className="font-mono resize-none overflow-y-auto flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 border-0 p-0"
                                  placeholder="{}"
                                />
                                {jsonError && jsonInput && (
                                  <Alert
                                    variant="destructive"
                                    className="mt-2 shrink-0"
                                  >
                                    <AlertTitle className="text-xs font-semibold">
                                      {t("MCP.jsonError")}
                                    </AlertTitle>
                                    <AlertDescription className="text-xs">
                                      {jsonError}
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </TabsContent>
                              <TabsContent
                                value="schema"
                                className="h-full m-0"
                              >
                                <JsonView
                                  data={selectedTool.inputSchema}
                                  initialExpandDepth={3}
                                />
                              </TabsContent>
                            </div>
                          </Tabs>
                        </div>
                      </div>

                      {/* Right column: Call button (top-right of JSON), Results below */}
                      <div className="flex flex-col min-h-0">
                        <div className="mb-3 flex justify-center px-4">
                          <Button
                            onClick={handleToolCall}
                            disabled={!!jsonError || isCallLoading}
                            className="w-full"
                          >
                            {isCallLoading && (
                              <Loader className="size-4 animate-spin mr-2" />
                            )}
                            {t("MCP.callTool")}
                          </Button>
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col">
                          {isNull(callResult) ? (
                            <div className="border border-input rounded-md p-4 flex-1 min-h-0 overflow-auto relative">
                              <p className="pointer-events-none select-none text-xs text-muted-foreground/60">
                                {t("Common.result")}
                              </p>
                            </div>
                          ) : callResult.success ? (
                            <div className="border border-input rounded-md p-4 flex-1 min-h-0 overflow-auto">
                              <JsonView
                                data={callResult.data}
                                initialExpandDepth={2}
                              />
                            </div>
                          ) : (
                            <Alert
                              variant="destructive"
                              className="mt-2 border-destructive"
                            >
                              <AlertTitle className="text-xs font-semibold">
                                {t("Common.error")}
                              </AlertTitle>
                              <AlertDescription className="text-xs mt-2 text-destructive">
                                <pre className="whitespace-pre-wrap">
                                  {isString(callResult.error)
                                    ? callResult.error
                                    : JSON.stringify(callResult.error, null, 2)}
                                </pre>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bg-secondary/30 p-4 rounded-md">
                      <p className="text-sm text-center text-muted-foreground">
                        {t("MCP.noInputSchemaDefined")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">
                  {t("MCP.selectToolToTest")}
                </p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
