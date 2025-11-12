import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  stepCountIs,
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
import { nanoBananaTool, openaiImageTool } from "lib/ai/tools/image";
import { ImageToolName } from "lib/ai/tools";
import { buildCsvIngestionPreviewParts } from "@/lib/ai/ingest/csv-ingest";
import { serverFileStorage } from "lib/file-storage";

const logger = globalLogger.withDefaults({
  message: colorize("blackBright", `Chat API: `),
});

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
      chatModels, // New: Multi-agent array
      chatModel, // Keep: Single model compatibility
      toolChoice,
      allowedAppDefaultToolkit,
      allowedMcpServers,
      imageTool,
      mentions = [],
      attachments = [],
    } = chatApiSchemaRequestBodySchema.parse(json);

    // Unified processing: build target models array
    const targetModels = chatModels?.length
      ? chatModels
      : chatModel
        ? [
            {
              provider: chatModel.provider,
              model: chatModel.model,
              agentId:
                mentions?.find((m) => m.type === "agent")?.agentId || null,
              agentName:
                mentions?.find((m) => m.type === "agent")?.name || "Assistant",
            },
          ]
        : [];

    if (targetModels.length === 0) {
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

    // Unified processing for single or multiple models
    return handleChatModels(targetModels, {
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

// Unified processing function for single or multiple models
async function handleChatModels(
  targetModels: {
    provider: string;
    model: string;
    agentId: string | null;
    agentName: string;
  }[],
  context: {
    id: string;
    message: UIMessage;
    messages: UIMessage[];
    toolChoice: "auto" | "none" | "manual";
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

  // Process all models concurrently (1 or more)
  const modelResponses = await Promise.all(
    targetModels.map(async (targetModel) => {
      const model = await customModelProvider.getModel({
        provider: targetModel.provider,
        model: targetModel.model,
      });

      const agent = targetModel.agentId
        ? await rememberAgentAction(targetModel.agentId, session.user.id)
        : null;

      // Build agent-specific mentions
      const agentMentions = [...mentions];
      if (agent?.instructions?.mentions) {
        agentMentions.push(...agent.instructions.mentions);
      }

      const supportToolCall =
        await customModelProvider.isToolCallSupported(model);
      const useImageTool = Boolean(imageTool?.model);
      const isToolCallAllowed =
        supportToolCall &&
        (toolChoice != "none" || agentMentions.length > 0) &&
        !useImageTool;

      const metadata: ChatMetadata = {
        agentId: targetModel.agentId || undefined,
        agentName: targetModel.agentName,
        toolChoice: toolChoice,
        toolCount: 0,
        chatModel: {
          provider: targetModel.provider,
          model: targetModel.model,
        },
      };

      // Create independent response stream for each model
      const stream = createUIMessageStream({
        execute: async ({ writer: dataStream }) => {
          const mcpClients = await mcpClientsManager.getClients();
          const mcpTools = await mcpClientsManager.tools();
          logger.info(
            `Agent: ${targetModel.agentName}, mcp-server count: ${mcpClients.length}, mcp-tools count: ${Object.keys(mcpTools).length}`,
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
                    : openaiImageTool,
              }
            : {};

          const vercelAITooles = safe({
            ...MCP_TOOLS,
            ...WORKFLOW_TOOLS,
          })
            .map((t) => {
              const bindingTools =
                toolChoice === "manual" ||
                (message.metadata as ChatMetadata)?.toolChoice === "manual"
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
            `Agent: ${targetModel.agentName}, model: ${targetModel.provider}/${targetModel.model}, tool mode: ${toolChoice}, mentions: ${agentMentions.length}`,
          );

          const result = streamText({
            model,
            system: systemPrompt,
            messages: convertToModelMessages(messages),
            experimental_transform: smoothStream({ chunking: "word" }),
            maxRetries: 2,
            tools: vercelAITooles,
            stopWhen: stepCountIs(10),
            toolChoice: "auto",
            abortSignal: request.signal,
            headers: {
              "user-id": session.user.email,
            },
          });

          result.consumeStream();
          dataStream.merge(
            result.toUIMessageStream({
              messageMetadata: ({ part }) => {
                if (part.type == "finish") {
                  metadata.usage = part.totalUsage;
                  return metadata;
                }
              },
            }),
          );
        },
        generateId: generateUUID,
        onFinish: async ({ responseMessage }) => {
          if (responseMessage.id == message.id) {
            await chatRepository.upsertMessage({
              threadId: thread.id,
              ...responseMessage,
              parts: responseMessage.parts.map(convertToSavePart),
              metadata,
            });
          } else {
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
        agentId: targetModel.agentId || "default",
        agentName: targetModel.agentName,
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
    // Multiple models: return merged stream
    return createMultiModelStreamResponse(modelResponses);
  }
}

// Multi-model stream response handler
function createMultiModelStreamResponse(
  responses: {
    agentId: string;
    agentName: string;
    stream: any;
    metadata: ChatMetadata;
  }[],
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send response header information
      const header = {
        type: "multi-agent",
        responses: responses.map((r) => ({
          agentId: r.agentId,
          agentName: r.agentName,
          metadata: r.metadata,
        })),
      };

      controller.enqueue(encoder.encode(`data: ${JSON.stringify(header)}\n\n`));

      // Process all agent response streams concurrently
      responses.forEach((response) => {
        // Note: This is a simplified implementation
        // In practice, you'd need to properly handle the stream merging
        response.stream.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              const wrappedChunk = {
                agentId: response.agentId,
                data: chunk,
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(wrappedChunk)}\n\n`),
              );
            },
          }),
        );
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
