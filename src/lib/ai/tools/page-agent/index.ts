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

// Create Page Agent tool - get configuration dynamically
export const pageAgentTool = createTool({
  description:
    "Control web interfaces with natural language. Click buttons, fill forms, navigate pages, and perform other web interactions using simple commands. This tool executes on the client side using your selected model.",
  inputSchema: pageAgentSchema,
  execute: async (params) => {
    try {
      console.log("=== Page Agent Tool Debug ===");
      console.log("params:", JSON.stringify(params, null, 2));
      console.log("==========================");

      // Get user selected model from messages metadata
      let selectedModel;

      // Method 2: Try to get from global app state (fallback)
      if (!selectedModel) {
        try {
          const { appStore } = await import("@/app/store");
          selectedModel = appStore.getState().chatModel;
          console.log("✅ Got model from global state:", selectedModel);
        } catch (error) {
          console.log("❌ Failed to get from global state:", error);
        }
      }

      selectedModel = {
        provider: "openai",
        model: "gpt-5.4",
      };

      if (!selectedModel) {
        console.log("❌ No model found in any source");
        return {
          isError: true,
          error: "No model selected. Please select a model from the dropdown.",
        };
      }

      console.log("🎯 Final selectedModel:", selectedModel);

      // Get provider configuration from database
      const selectedProvider = await providerRepository.selectByName(
        selectedModel.provider,
      );

      if (!selectedProvider) {
        console.log("❌ Provider not found:", selectedModel.provider);
        return {
          isError: true,
          error: `Provider ${selectedModel.provider} not found in database.`,
        };
      }

      console.log("✅ Got provider from database:", selectedProvider.name);

      // Build configuration from user's actual selection
      const config = {
        model: selectedModel.model,
        baseURL: selectedProvider.baseUrl,
        apiKey: selectedProvider.apiKey || "empty",
        language: "en-US", // Default language
      };

      console.log("🔧 Final config:", config);

      return {
        requiresClientSide: true,
        command: params.command, // User's actual command
        config,
        message:
          "This command will be executed on the client side by Page Agent.",
      };
    } catch (error) {
      console.log("❌ Error in execute:", error);
      return {
        isError: true,
        error: `Failed to get model configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

// Export tool name for reference
export const PAGE_AGENT_TOOL_NAME = "page-agent";
