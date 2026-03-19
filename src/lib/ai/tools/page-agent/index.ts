import { tool as createTool } from "ai";
import { z } from "zod";
import { providerRepository } from "lib/db/repository";

// Zod schema for Page Agent tool parameters - only user command
const pageAgentSchema = z.object({
  command: z
    .string()
    .describe(
      "Natural language command to execute on web page (e.g., 'Click login button', 'Fill in email field')",
    ),
});

/**
 * Factory that creates a Page Agent tool bound to the user's currently selected
 * model. Must be called per-request inside the chat API handler so that the
 * correct provider configuration is resolved at runtime.
 *
 * This follows the same pattern as `workflowToVercelAITool`, where runtime
 * context is closed over instead of being accessed through global state.
 */
export const createPageAgentTool = (chatModel: {
  provider: string;
  model: string;
}) =>
  createTool({
    description:
      "Control web interfaces with natural language. Click buttons, fill forms, navigate pages, and perform other web interactions using simple commands. This tool executes on the client side.",
    inputSchema: pageAgentSchema,
    execute: async (params) => {
      try {
        // chatModel is provided via closure from the request context —
        const selectedProvider = await providerRepository.selectByName(
          chatModel.provider,
        );

        if (!selectedProvider) {
          return {
            isError: true,
            error: `Model "${chatModel.model}" not found.`,
          };
        }

        const config = {
          model: chatModel.model,
          baseURL: selectedProvider.baseUrl,
          apiKey: selectedProvider.apiKey || "",
          language: "en-US" as const,
        };

        return {
          command: params.command,
          config,
          message:
            "This command will be executed on the client side by Page Agent.",
        };
      } catch (error) {
        return {
          isError: true,
          error: `Failed to get model configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  });
