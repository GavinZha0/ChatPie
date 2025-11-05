import "server-only";

import { LanguageModel } from "ai";
import { ChatModel } from "app-types/chat";
import type { LlmModel } from "app-types/llm";
import { Provider } from "app-types/provider";
import { createOllama } from "ollama-ai-provider-v2";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGroq } from "@ai-sdk/groq";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createQwen } from "qwen-ai-provider";
import { createDifyProvider } from "dify-ai-provider";
import { providerRepository, llmRepository } from "lib/db/repository";
import logger from "logger";
import {
  DEFAULT_FILE_PART_MIME_TYPES,
  OPENAI_FILE_MIME_TYPES,
  GEMINI_FILE_MIME_TYPES,
  ANTHROPIC_FILE_MIME_TYPES,
  XAI_FILE_MIME_TYPES,
} from "./file-support";

// ============================================
// Type Definitions
// ============================================

/**
 * Provider SDK factory type - supports optional second parameter for providers like Dify
 */
type ProviderSDKFactory = (
  modelId: string,
  options?: { apiKey?: string },
) => LanguageModel;

// ============================================
// Constants
// ============================================

/**
 * File type support configuration (by provider)
 */
const providerFileSupportMap: Record<string, readonly string[]> = {
  openai: OPENAI_FILE_MIME_TYPES,
  google: GEMINI_FILE_MIME_TYPES,
  anthropic: ANTHROPIC_FILE_MIME_TYPES,
  xai: XAI_FILE_MIME_TYPES,
  openRouter: DEFAULT_FILE_PART_MIME_TYPES,
};

type ModelCapability = {
  supportsFunctionCall: boolean;
  supportsImageInput: boolean;
};

// ============================================
// Cache Management
// ============================================

/**
 * Model cache type definition
 */
type ModelsCache = {
  models: Record<string, Record<string, LanguageModel>>;
  unsupportedModels: Set<LanguageModel>;
  filePartSupportByModel: Map<LanguageModel, readonly string[]>;
  providers: Provider[];
  modelCapabilities: Map<LanguageModel, ModelCapability>;
  timestamp: number;
} | null;

/**
 * Global model cache
 */
let modelsCache: ModelsCache = null;

/**
 * Cache TTL (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

// ============================================
// Core Functionality
// ============================================

/**
 * Create a provider SDK factory
 * @param providerName Provider name
 * @param config Provider configuration
 * @returns A factory function that creates model instances
 */
function createProviderSDK(
  providerName: string,
  config: Provider,
): ProviderSDKFactory | null {
  const apiKey = config.apiKey || undefined;
  const baseURL = config.baseUrl || undefined;

  switch (providerName) {
    case "openai": {
      const provider = createOpenAI({ baseURL, apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "google": {
      const provider = createGoogleGenerativeAI({ baseURL, apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "anthropic": {
      const provider = createAnthropic({ baseURL, apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "xai": {
      const provider = createXai({ baseURL, apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "ollama": {
      if (!apiKey || apiKey === "empty") {
        const provider = createOllama({ baseURL });
        return (modelId: string) =>
          provider(modelId) as unknown as LanguageModel;
      } else {
        const provider = createOllama({
          baseURL,
          headers: { Authorization: "Bearer " + apiKey },
        });
        return (modelId: string) =>
          provider(modelId) as unknown as LanguageModel;
      }
    }
    case "groq": {
      const provider = createGroq({ baseURL, apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "openrouter": {
      const provider = createOpenRouter({ baseURL, apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "deepseek": {
      const provider = createDeepSeek({ baseURL, apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "qwen": {
      const provider = createQwen({ baseURL, apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "dify": {
      const provider = createDifyProvider({ baseURL });
      return (modelId: string, options?: { apiKey?: string }) => {
        return provider(modelId, options) as unknown as LanguageModel;
      };
    }
    default:
      return null;
  }
}

/**
 * Load all models from database and create instances
 * Results are cached for 5 minutes to reduce database queries
 */
export async function loadDynamicModels() {
  // If cache is valid, return cached result directly
  if (modelsCache && Date.now() - modelsCache.timestamp < CACHE_TTL) {
    return modelsCache;
  }

  try {
    const providers = await providerRepository.selectAll();

    const llmRecords = await llmRepository.selectAll();
    const llmByProvider = new Map<string, Map<string, LlmModel>>();
    for (const llm of llmRecords) {
      if (!llmByProvider.has(llm.provider)) {
        llmByProvider.set(llm.provider, new Map());
      }
      llmByProvider.get(llm.provider)!.set(llm.id, llm);
    }

    const models: Record<string, Record<string, LanguageModel>> = {};
    const unsupportedModels = new Set<LanguageModel>();
    const filePartSupportByModel = new Map<LanguageModel, readonly string[]>();
    const modelCapabilities = new Map<LanguageModel, ModelCapability>();

    for (const provider of providers) {
      // Skip providers without API key (except ollama)
      if (
        (!provider.baseUrl || !provider.apiKey) &&
        provider.name !== "ollama"
      ) {
        continue;
      }

      // Get the provider's SDK factory
      const createModel = createProviderSDK(provider.name, provider);
      if (!createModel) {
        logger.warn(`Create ${provider.name} SDK failed, skipping`);
        continue;
      }

      // Build all models for this provider
      const providerModels: Record<string, LanguageModel> = {};
      const llmConfigs = provider.llm || [];

      for (const llmConfig of llmConfigs) {
        if (!llmConfig.enabled) {
          continue;
        }

        try {
          // Create model instance
          // For Dify provider, pass apiKey in options; options will be ignored for other providers
          const model = createModel(
            llmConfig.id,
            provider.name === "dify"
              ? { apiKey: provider.apiKey || undefined }
              : undefined,
          );
          providerModels[llmConfig.id] = model;

          const llmInfo =
            llmByProvider.get(provider.name)?.get(llmConfig.id) ?? null;

          const supportsFunctionCall = llmInfo?.functionCall ?? true;
          const supportsImageInput = llmInfo?.imageInput ?? true;

          if (!supportsFunctionCall) {
            unsupportedModels.add(model);
          }

          modelCapabilities.set(model, {
            supportsFunctionCall,
            supportsImageInput,
          });

          // Register file support
          const fileMimeTypes =
            providerFileSupportMap[provider.name] ||
            DEFAULT_FILE_PART_MIME_TYPES;
          filePartSupportByModel.set(model, fileMimeTypes);
        } catch (error) {
          logger.error(
            `Failed to create model ${llmConfig.id} for provider ${provider.name}:`,
            error,
          );
        }
      }

      if (Object.keys(providerModels).length > 0) {
        models[provider.name] = providerModels;
      }
    }

    // Cache result
    modelsCache = {
      models,
      unsupportedModels,
      filePartSupportByModel,
      providers,
      modelCapabilities,
      timestamp: Date.now(),
    };

    return modelsCache;
  } catch (error) {
    logger.error("Failed to load dynamic models:", error);
    // Return empty result instead of throwing error, keep app availability
    return {
      models: {},
      unsupportedModels: new Set<LanguageModel>(),
      filePartSupportByModel: new Map<LanguageModel, readonly string[]>(),
      providers: [],
      modelCapabilities: new Map<LanguageModel, ModelCapability>(),
    };
  }
}

/**
 * Invalidate the models cache
 * Call this when provider configuration changes
 */
export function invalidateModelsCache() {
  modelsCache = null;
}

// ============================================
// Public API
// ============================================

/**
 * Custom model provider with pure dynamic database-driven configuration
 * All models are loaded from database, no static configuration
 */
export const customModelProvider = {
  /**
   * Get model information from database
   */
  async getModelsInfo() {
    const dynamicData = await loadDynamicModels();

    return dynamicData.providers.map((provider) => ({
      id: provider.id,
      provider: provider.name,
      alias: provider.alias,
      models: (provider.llm || [])
        .filter((llm) => llm.enabled)
        .map((llm) => {
          const model = dynamicData.models[provider.name]?.[llm.id];
          const capabilities = model
            ? dynamicData.modelCapabilities.get(model)
            : undefined;
          const supportsFunctionCall =
            capabilities?.supportsFunctionCall ?? true;
          const supportsImageInput = capabilities?.supportsImageInput ?? true;
          return {
            name: llm.id,
            isToolCallUnsupported: !supportsFunctionCall,
            isImageInputUnsupported: !supportsImageInput,
            supportedFileMimeTypes: model
              ? [...(dynamicData.filePartSupportByModel.get(model) || [])]
              : [],
          };
        }),
      hasAPIKey: !!provider.apiKey || provider.name === "ollama",
    }));
  },

  /**
   * Get a specific model instance from database
   * @param model Model identifier
   * @returns The model instance
   */
  async getModel(model?: ChatModel): Promise<LanguageModel> {
    const dynamicData = await loadDynamicModels();

    if (!model) {
      // Get the first available model as fallback
      const firstProvider = dynamicData.providers[0];
      if (firstProvider) {
        const firstEnabledModel = firstProvider.llm?.find((m) => m.enabled);
        if (firstEnabledModel) {
          const fallbackModel =
            dynamicData.models[firstProvider.name]?.[firstEnabledModel.id];
          if (fallbackModel) {
            return fallbackModel;
          }
        }
      }
      throw new Error("No models available in database");
    }

    const dynamicModel = dynamicData.models[model.provider]?.[model.model];
    if (!dynamicModel) {
      throw new Error(
        `Model ${model.provider}/${model.model} not found in database or not enabled`,
      );
    }

    return dynamicModel;
  },

  /**
   * Check if a model supports tool calls
   * @param model Model instance
   * @returns Whether tool calls are supported
   */
  async isToolCallSupported(model: LanguageModel): Promise<boolean> {
    const dynamicData = await loadDynamicModels();
    const capabilities = dynamicData.modelCapabilities.get(model);
    return capabilities?.supportsFunctionCall ?? true;
  },
};
