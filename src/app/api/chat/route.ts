import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  streamText,
  Tool,
  UIMessage,
} from "ai";

import { customModelProvider } from "lib/ai/models";

import { mcpClientsManager } from "lib/ai/mcp/mcp-manager";

import { chatRepository } from "lib/db/repository";
import globalLogger from "logger";
import {
  buildMcpServerCustomizationsSystemPrompt,
  buildUserSystemPrompt,
  buildToolCallUnsupportedModelSystemPrompt,
} from "lib/ai/prompts";
import {
  chatApiSchemaRequestBodySchema,
  ChatMention,
  ChatMetadata,
  MyUIMessage,
} from "app-types/chat";

import { errorIf, safe } from "ts-safe";

import {
  excludeToolExecution,
  handleError,
  manualToolExecuteByLastMessage,
  mergeSystemPrompt,
  extractInProgressToolPart,
  filterMcpServerCustomizations,
  loadMcpTools,
  loadWorkFlowTools,
  loadAppDefaultTools,
  convertToSavePart,
} from "./shared.chat";
import {
  rememberAgentAction,
  rememberMcpServerCustomizationsAction,
} from "./actions";
import { getSession } from "auth/server";
import { colorize } from "consola/utils";
import { generateUUID } from "lib/utils";
import { nanoBananaTool, openaiImageAdapterTool } from "lib/ai/tools/image";
import { ImageToolName } from "lib/ai/tools";
import { buildCsvIngestionPreviewParts } from "@/lib/ai/ingest/csv-ingest";
import { serverFileStorage } from "lib/file-storage";

const logger = globalLogger.withDefaults({
  message: colorize("blackBright", `Chat API: `),
});

// receive chat message from client
export async function POST(request: Request) {
  try {
    const json = await request.json();

    const session = await getSession();

    if (!session?.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }
    const {
      id,
      message,
      chatModel,
      toolChoice,
      allowedAppDefaultToolkit,
      allowedMcpServers,
      imageTool,
      mentions = [],
      attachments = [],
    } = chatApiSchemaRequestBodySchema.parse(json);

    // agent mentions have models
    const agentMentions = mentions.filter((m) => m.type === "agent");
    if (agentMentions.length === 0 && !chatModel) {
      return new Response("No valid models specified", { status: 400 });
    }

    let thread = await chatRepository.selectThreadDetails(id);

    if (!thread) {
      logger.info(`create chat thread: ${id}`);
      const newThread = await chatRepository.insertThread({
        id,
        title: "",
        userId: session.user.id,
      });
      thread = await chatRepository.selectThreadDetails(newThread.id);
    }

    if (thread!.userId !== session.user.id) {
      return new Response("Forbidden", { status: 403 });
    }

    const messages: UIMessage[] = (thread?.messages ?? []).map((m) => {
      return {
        id: m.id,
        role: m.role,
        parts: m.parts,
        metadata: m.metadata,
      };
    });

    if (messages.at(-1)?.id == message.id) {
      messages.pop();
    }
    const ingestionPreviewParts = await buildCsvIngestionPreviewParts(
      attachments,
      (key) => serverFileStorage.download(key),
    );
    if (ingestionPreviewParts.length) {
      const baseParts = [...message.parts];
      let insertionIndex = -1;
      for (let i = baseParts.length - 1; i >= 0; i -= 1) {
        if (baseParts[i]?.type === "text") {
          insertionIndex = i;
          break;
        }
      }
      if (insertionIndex !== -1) {
        baseParts.splice(insertionIndex, 0, ...ingestionPreviewParts);
        message.parts = baseParts;
      } else {
        message.parts = [...baseParts, ...ingestionPreviewParts];
      }
    }

    if (attachments.length) {
      const firstTextIndex = message.parts.findIndex(
        (part: any) => part?.type === "text",
      );
      const attachmentParts: any[] = [];

      attachments.forEach((attachment) => {
        const exists = message.parts.some(
          (part: any) =>
            part?.type === attachment.type && part?.url === attachment.url,
        );
        if (exists) return;

        if (attachment.type === "file") {
          attachmentParts.push({
            type: "file",
            url: attachment.url,
            mediaType: attachment.mediaType,
            filename: attachment.filename,
          });
        } else if (attachment.type === "source-url") {
          attachmentParts.push({
            type: "source-url",
            url: attachment.url,
            mediaType: attachment.mediaType,
            title: attachment.filename,
          });
        }
      });

      if (attachmentParts.length) {
        if (firstTextIndex >= 0) {
          message.parts = [
            ...message.parts.slice(0, firstTextIndex),
            ...attachmentParts,
            ...message.parts.slice(firstTextIndex),
          ];
        } else {
          message.parts = [...message.parts, ...attachmentParts];
        }
      }
    }

    messages.push(message);

    // support model only, single agent or multiple agents
    // chatModel is selected model by user
    // mentions may have single agent or multiple agents with pre-defined models
    return handleChatModels(chatModel, {
      id,
      message,
      messages,
      toolChoice,
      allowedAppDefaultToolkit,
      allowedMcpServers,
      imageTool,
      mentions,
      attachments,
      session,
      thread: thread!,
      request,
    });
  } catch (error: any) {
    logger.error(error);
    return Response.json({ message: error.message }, { status: 500 });
  }
}

// Helper function to get the last Dify conversation ID from previous messages
function getLastDifyConversationId(
  messages: UIMessage[],
  modelToUse: { provider: string; model: string },
): string | undefined {
  // Only check for Dify providers
  if (modelToUse.provider !== "dify") {
    return undefined;
  }

  // Iterate through messages in reverse order to find the most recent one with difyConversationId
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (
      message.metadata &&
      (message.metadata as ChatMetadata).difyConversationId
    ) {
      const conversationId = (message.metadata as ChatMetadata)
        .difyConversationId;
      return conversationId;
    }
  }

  return undefined;
}

// Unified processing function for single or multiple models
async function handleChatModels(
  chatModel:
    | {
        provider: string;
        model: string;
      }
    | undefined,
  context: {
    id: string;
    message: UIMessage;
    messages: UIMessage[];
    toolChoice: "auto" | "manual" | "approval";
    allowedAppDefaultToolkit?: string[];
    allowedMcpServers?: Record<string, any>;
    imageTool?: { model?: string };
    mentions: ChatMention[];
    attachments: any[];
    session: any;
    thread: any;
    request: Request;
  },
) {
  const {
    message,
    messages,
    toolChoice,
    allowedAppDefaultToolkit,
    allowedMcpServers,
    imageTool,
    mentions,
    session,
    thread,
    request,
  } = context;

  // Extract agent IDs from mentions for multi-agent support
  const agentMentions = mentions.filter((m) => m.type === "agent");
  const agentIdsToProcess =
    agentMentions.length > 0 ? agentMentions.map((m) => m.agentId) : [null]; // null represents no agent (use chatModel)

  const modelResponses = await Promise.all(
    agentIdsToProcess.map(async (agentId) => {
      // Get complete agent info from cache/db if agent id exists
      const agent = agentId
        ? await rememberAgentAction(agentId, session.user.id)
        : null;

      // Determine the model to use: chatModel (if provided) or agent's model
      // chatModel takes priority - when frontend sends it, user wants to use that model
      // When chatModel is undefined, use agent's predefined model
      const modelToUse = chatModel || agent?.model;
      if (!modelToUse) {
        throw new Error(
          `No model specified for ${agent ? `agent ${agent.name}` : "chat"}`,
        );
      }

      const agentName = agent?.name || "null";
      // Language model that is used by the AI SDK Core functions
      const model = await customModelProvider.getModel(modelToUse);

      // Build agent-specific mentions
      const agentMentions = [...mentions];
      if (agent?.tools) {
        agentMentions.push(...agent.tools);
      }

      const supportToolCall =
        await customModelProvider.isToolCallSupported(model);
      const useImageTool = Boolean(imageTool?.model);
      const isToolCallAllowed =
        supportToolCall &&
        (toolChoice != "manual" || agentMentions.length > 0) &&
        !useImageTool;

      // pass to frontend for multi-agent support
      // and save to db as chat log
      const metadata: ChatMetadata = {
        agentId,
        agentName,
        toolChoice,
        toolCount: 0,
        chatModel: modelToUse,
      };

      // Create independent response stream for each model
      const stream = createUIMessageStream({
        execute: async ({ writer: dataStream }) => {
          const mcpClients = await mcpClientsManager.getClients();
          const mcpTools = await mcpClientsManager.tools();
          logger.info(
            `Agent: ${agentName}, mcp-server count: ${mcpClients.length}, mcp-tools count: ${Object.keys(mcpTools).length}`,
          );

          const MCP_TOOLS = await safe()
            .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
            .map(() =>
              loadMcpTools({
                mentions: agentMentions,
                allowedMcpServers,
              }),
            )
            .orElse({});

          const WORKFLOW_TOOLS = await safe()
            .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
            .map(() =>
              loadWorkFlowTools({
                mentions: agentMentions,
                dataStream,
              }),
            )
            .orElse({});

          const APP_DEFAULT_TOOLS = await safe()
            .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
            .map(() =>
              loadAppDefaultTools({
                mentions: agentMentions,
                allowedAppDefaultToolkit,
              }),
            )
            .orElse({});

          const inProgressToolParts = extractInProgressToolPart(message);
          if (inProgressToolParts.length) {
            await Promise.all(
              inProgressToolParts.map(async (part) => {
                const output = await manualToolExecuteByLastMessage(
                  part,
                  { ...MCP_TOOLS, ...WORKFLOW_TOOLS, ...APP_DEFAULT_TOOLS },
                  request.signal,
                );
                part.output = output;

                dataStream.write({
                  type: "tool-output-available",
                  toolCallId: part.toolCallId,
                  output,
                });
              }),
            );
          }

          const userPreferences = thread?.userPreferences || undefined;

          const mcpServerCustomizations = await safe()
            .map(() => {
              if (Object.keys(MCP_TOOLS ?? {}).length === 0)
                throw new Error("No tools found");
              return rememberMcpServerCustomizationsAction(session.user.id);
            })
            .map((v) => filterMcpServerCustomizations(MCP_TOOLS!, v))
            .orElse({});

          const systemPrompt = mergeSystemPrompt(
            buildUserSystemPrompt(
              session.user,
              userPreferences,
              agent || undefined,
            ),
            buildMcpServerCustomizationsSystemPrompt(mcpServerCustomizations),
            !supportToolCall && buildToolCallUnsupportedModelSystemPrompt,
          );

          const IMAGE_TOOL: Record<string, Tool> = useImageTool
            ? {
                [ImageToolName]:
                  imageTool?.model === "google"
                    ? nanoBananaTool
                    : openaiImageAdapterTool,
              }
            : {};

          const vercelAITooles = safe({
            ...MCP_TOOLS,
            ...WORKFLOW_TOOLS,
          })
            .map((t) => {
              const bindingTools =
                toolChoice === "approval" ||
                (message.metadata as ChatMetadata)?.toolChoice === "approval"
                  ? excludeToolExecution(t)
                  : t;
              return {
                ...bindingTools,
                ...APP_DEFAULT_TOOLS,
                ...IMAGE_TOOL,
              };
            })
            .unwrap();

          metadata.toolCount = Object.keys(vercelAITooles).length;

          logger.info(
            `Agent: ${agentName}, model: ${modelToUse.provider}/${modelToUse.model}, tool mode: ${toolChoice}, mentions: ${agentMentions.length}`,
          );

          // Get the last Dify conversation ID if this is a Dify provider
          const lastDifyConversationId = getLastDifyConversationId(
            messages,
            modelToUse,
          );

          // Prepare headers for the request
          const headers: Record<string, string> = {
            "user-id": session.user.email,
          };

          // Add chat-id header for Dify providers to maintain conversation continuity
          if (lastDifyConversationId) {
            headers["chat-id"] = lastDifyConversationId;
          }

          // For Dify providers, also set response mode to blocking to ensure conversation ID is returned
          let difySettings = {};
          if (modelToUse.provider === "dify") {
            difySettings = {
              responseMode: "blocking",
            };
          }

          const result = streamText({
            model,
            system: systemPrompt,
            messages: convertToModelMessages(messages),
            experimental_transform: smoothStream({ chunking: "word" }),
            maxRetries: 2,
            tools: vercelAITooles,
            toolChoice: toolChoice === "manual" ? "none" : "auto",
            abortSignal: request.signal,
            headers,
            ...difySettings,
          });

          result.consumeStream();
          dataStream.merge(
            result.toUIMessageStream({
              messageMetadata: ({ part }) => {
                // Capture Dify conversation ID from finish-step part
                if (part.type == "finish-step") {
                  const finishStepPart = part as any;

                  // Try to get conversationId from finish-step
                  let conversationId: string | undefined;

                  // Path: difyWorkflowData (for workflow type)
                  if (
                    finishStepPart.providerMetadata?.difyWorkflowData
                      ?.conversationId
                  ) {
                    conversationId = finishStepPart.providerMetadata
                      .difyWorkflowData.conversationId as string;

                    // Store it in metadata for use in finish part
                    metadata.difyConversationId = conversationId;
                  }
                }

                if (part.type == "finish") {
                  // add usage to metadata and send to frontend
                  metadata.usage = part.totalUsage;

                  // conversationId should already be captured from finish-step, but let's double-check
                  const finishPart = part as any;

                  // If we didn't get it from finish-step, try to get it from finish part
                  if (!metadata.difyConversationId) {
                    let conversationId: string | undefined;

                    // Path 1: Original difyWorkflowData (for workflow type)
                    if (
                      finishPart.providerMetadata?.difyWorkflowData
                        ?.conversationId
                    ) {
                      conversationId = finishPart.providerMetadata
                        .difyWorkflowData.conversationId as string;
                    }
                    // Path 2: Direct providerMetadata (for chat/agent type)
                    else if (finishPart.providerMetadata?.conversationId) {
                      conversationId = finishPart.providerMetadata
                        .conversationId as string;
                    }
                    // Path 3: Root level (less likely but possible)
                    else if (finishPart.conversationId) {
                      conversationId = finishPart.conversationId as string;
                    }

                    if (conversationId) {
                      metadata.difyConversationId = conversationId;
                      logger.info(
                        "Using conversationId captured from finish part:",
                        conversationId,
                      );
                    }
                  } else {
                    logger.info(
                      "Using conversationId captured from finish-step:",
                      metadata.difyConversationId,
                    );
                  }

                  return metadata;
                }
              },
            }),
          );
        },
        generateId: generateUUID,
        onFinish: async ({ responseMessage }) => {
          // save message to db
          if (responseMessage.id == message.id) {
            await chatRepository.upsertMessage({
              threadId: thread.id,
              ...responseMessage,
              parts: responseMessage.parts.map(convertToSavePart),
              metadata,
            });
          } else {
            // save role and message to db
            await chatRepository.upsertMessage({
              threadId: thread.id,
              role: message.role,
              parts: message.parts.map(convertToSavePart),
              id: message.id,
            });
            await chatRepository.upsertMessage({
              threadId: thread.id,
              role: responseMessage.role,
              id: responseMessage.id,
              parts: responseMessage.parts.map(convertToSavePart),
              metadata,
            });
          }
        },
        onError: handleError,
        originalMessages: messages,
      });

      return {
        stream,
        metadata,
      };
    }),
  );

  // Return response based on number of models
  if (modelResponses.length === 1) {
    // Single model: return existing format
    return createUIMessageStreamResponse({
      stream: modelResponses[0].stream,
    });
  } else {
    // Multiple models: return tagged merged stream
    const mergedStream = createTaggedMergedStream(modelResponses, context);
    return createUIMessageStreamResponse({
      stream: mergedStream,
    });
  }
}

// Tagged stream merger for multiple agents
function createTaggedMergedStream(
  responses: {
    stream: any;
    metadata: ChatMetadata;
  }[],
  context: {
    id: string;
    message: UIMessage;
    messages: UIMessage[];
    session: any;
    thread: any;
  },
) {
  return createUIMessageStream<MyUIMessage>({
    execute: async ({ writer }) => {
      // Process all agent streams concurrently
      await Promise.all(
        responses.map(async ({ stream, metadata }) => {
          const { agentId = "default", agentName = "Assistant" } = metadata;
          try {
            // Get reader from the stream directly
            const reader = stream.getReader();
            let currentBlockId: string | undefined = undefined;
            let currentToolCallId: string | undefined = undefined;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const rawBlockId = extractBlockId(value);
              const rawToolCallId = extractToolCallId(value);
              const blockId = rawBlockId || currentBlockId;
              const toolCallId = rawToolCallId || currentToolCallId;

              if (shouldTagChunk(value)) {
                // bind blockId to agentId for multiple agents
                if (blockId) currentBlockId = blockId;
                if (toolCallId) currentToolCallId = toolCallId;
                writer.write({
                  type: "data-agent-tag",
                  id: `tag-${agentId}-${extractChunkId(value)}`,
                  data: {
                    agentId,
                    agentName,
                    blockId,
                    toolCallId,
                    kind: value.type,
                  },
                });
              }

              writer.write(value);
            }

            // 3. Send agent finish marker
            writer.write({
              type: "data-agent-finish",
              id: `finish-${agentId}`,
              data: {
                agentId,
                agentName,
                usage: metadata.usage,
              },
            });
          } catch (error) {
            logger.error(`Error processing agent ${agentId}:`, error);
          }
        }),
      );
    },
    generateId: generateUUID,
    onFinish: async ({ responseMessage }) => {
      // Save user message once
      if (responseMessage.id === context.message.id) {
        await chatRepository.upsertMessage({
          threadId: context.thread.id,
          ...responseMessage,
          parts: responseMessage.parts.map(convertToSavePart),
        });
      } else {
        // Save user message
        await chatRepository.upsertMessage({
          threadId: context.thread.id,
          role: context.message.role,
          parts: context.message.parts.map(convertToSavePart),
          id: context.message.id,
        });

        // Save assistant message with all agent parts
        await chatRepository.upsertMessage({
          threadId: context.thread.id,
          role: responseMessage.role,
          id: responseMessage.id,
          parts: responseMessage.parts.map(convertToSavePart),
        });
      }
    },
  });
}

// Determine if a chunk should be tagged with agentId
function shouldTagChunk(chunk: any): boolean {
  const tagTypes = [
    "text-start",
    "text-delta",
    "step-start",
    "reasoning-start",
    "tool-input-start",
    "tool-output-available",
    "error",
  ];
  return tagTypes.includes(chunk.type) || chunk.type?.startsWith?.("tool-");
}

// Extract chunk identifier for tagging
function extractChunkId(chunk: any): string {
  return chunk.id || chunk.toolCallId || crypto.randomUUID();
}

// Extract block ID from chunk
function extractBlockId(chunk: any): string | undefined {
  return chunk.id;
}

// Extract tool call ID from chunk
function extractToolCallId(chunk: any): string | undefined {
  return chunk.toolCallId;
}
