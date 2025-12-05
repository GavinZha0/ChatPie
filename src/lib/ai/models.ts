import "server-only";

import { LanguageModel } from "ai";
import { ChatModel } from "app-types/chat";
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
import { createMistral } from "@ai-sdk/mistral";
import { createVercel } from "@ai-sdk/vercel";
import { createAzure } from "@ai-sdk/azure";
import { createFireworks } from "@ai-sdk/fireworks";
import { createZhipu } from "zhipu-ai-provider";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { providerRepository } from "lib/db/repository";
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
  openrouter: DEFAULT_FILE_PART_MIME_TYPES,
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
  filePartSupportByModel: Map<LanguageModel, readonly string[]>;
  providers: Provider[];
  modelCapabilities: Map<LanguageModel, ModelCapability>;
  timestamp: number;
  lastUpdatedAt: number;
} | null;

/**
 * Global model cache
 */
let modelsCache: ModelsCache = null;

/**
 * Providers that do not support model feature
 * - Exa AI: provide api for web search
 */
const UNVALID_PROVIDER_NAME = ["exa"];

/**
 * Cache TTL (30 minutes - balance between performance and real-time updates)
 */
const CACHE_TTL = 30 * 60 * 1000;

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
    case "mistral": {
      const provider = createMistral({ baseURL, apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "vercel": {
      const provider = createVercel({ apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "azure": {
      const provider = createAzure({ resourceName: baseURL, apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "fireworks": {
      const provider = createFireworks({ apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "perplexity": {
      const provider = createPerplexity({ apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "nvidia": {
      const provider = createOpenAICompatible({
        name: "nim",
        baseURL: baseURL || "",
        headers: { Authorization: "Bearer " + apiKey },
      });
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
    case "zhipu": {
      const provider = createZhipu({ baseURL, apiKey });
      return (modelId: string) => provider(modelId) as unknown as LanguageModel;
    }
    case "dify": {
      const provider = createDifyProvider({ baseURL });
      return (modelId: string, options?: { apiKey?: string }) => {
        return provider(modelId, {
          ...options,
          // Use blocking mode for Dify to ensure conversation ID is returned
          responseMode: "blocking",
        }) as unknown as LanguageModel;
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
  const latestUpdatedAt = await providerRepository.latestUpdatedAt();
  if (modelsCache) {
    const latestVersion = latestUpdatedAt ? latestUpdatedAt.getTime() : 0;
    const cacheVersionUpToDate = modelsCache.lastUpdatedAt >= latestVersion;
    const cacheWithinTTL = Date.now() - modelsCache.timestamp < CACHE_TTL;
    if (cacheVersionUpToDate && cacheWithinTTL) {
      return modelsCache;
    }
  }

  try {
    // Load all providers
    let providers = await providerRepository.selectAll();
    providers = providers.filter(
      (p) => !UNVALID_PROVIDER_NAME.includes(p.name),
    );

    const models: Record<string, Record<string, LanguageModel>> = {};
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

          const supportsFunctionCall = llmConfig.functionCall ?? true;
          const supportsImageInput = llmConfig.imageInput ?? true;

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
        if (models[provider.name]) {
          Object.assign(models[provider.name], providerModels);
        } else {
          models[provider.name] = providerModels;
        }
      }
    }

    const lastUpdated = providers.reduce<number>((acc, p) => {
      const t = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
      return t > acc ? t : acc;
    }, 0);
    modelsCache = {
      models,
      filePartSupportByModel,
      providers,
      modelCapabilities,
      timestamp: Date.now(),
      lastUpdatedAt: lastUpdated,
    };

    return modelsCache;
  } catch (error) {
    logger.error("Failed to load dynamic models:", error);
    // Return empty result instead of throwing error, keep app availability
    return {
      models: {},
      filePartSupportByModel: new Map<LanguageModel, readonly string[]>(),
      providers: [],
      modelCapabilities: new Map<LanguageModel, ModelCapability>(),
      timestamp: Date.now(),
      lastUpdatedAt: 0,
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

/**
 * Update specific provider in cache without full rebuild
 * @param providerName Name of the provider to update
 */
export async function updateProviderInCache(providerName: string) {
  if (!modelsCache) {
    // If no cache exists, just invalidate and let next call rebuild
    invalidateModelsCache();
    return;
  }

  try {
    // Get updated provider from database
    let updatedProviders = await providerRepository.selectAll();
    updatedProviders = updatedProviders.filter(
      (p) => !UNVALID_PROVIDER_NAME.includes(p.name),
    );
    const updatedProvider = updatedProviders.find(
      (p) => p.name === providerName,
    );

    if (!updatedProvider) {
      // Provider was deleted, remove from cache
      delete modelsCache.models[providerName];
      modelsCache.providers = updatedProviders;
      return;
    }

    // Skip providers without API key (except ollama)
    if (
      (!updatedProvider.baseUrl || !updatedProvider.apiKey) &&
      updatedProvider.name !== "ollama"
    ) {
      delete modelsCache.models[providerName];
      modelsCache.providers = updatedProviders;
      return;
    }

    // Create new models for this provider
    const createModel = createProviderSDK(
      updatedProvider.name,
      updatedProvider,
    );
    if (!createModel) {
      logger.warn(
        `Create ${updatedProvider.name} SDK failed during update, removing from cache`,
      );
      delete modelsCache.models[providerName];
      modelsCache.providers = updatedProviders;
      return;
    }

    const providerModels: Record<string, LanguageModel> = {};
    const llmConfigs = updatedProvider.llm || [];

    for (const llmConfig of llmConfigs) {
      if (!llmConfig.enabled) {
        continue;
      }

      try {
        const model = createModel(
          llmConfig.id,
          updatedProvider.name === "dify"
            ? { apiKey: updatedProvider.apiKey || undefined }
            : undefined,
        );
        providerModels[llmConfig.id] = model;

        const supportsFunctionCall = llmConfig.functionCall ?? true;
        const supportsImageInput = llmConfig.imageInput ?? true;

        modelsCache.modelCapabilities.set(model, {
          supportsFunctionCall,
          supportsImageInput,
        });

        const fileMimeTypes =
          providerFileSupportMap[updatedProvider.name] ||
          DEFAULT_FILE_PART_MIME_TYPES;
        modelsCache.filePartSupportByModel.set(model, fileMimeTypes);
      } catch (error) {
        logger.error(
          `Failed to create model ${llmConfig.id} for provider ${updatedProvider.name} during update:`,
          error,
        );
      }
    }

    // Update cache with new models
    if (Object.keys(providerModels).length > 0) {
      modelsCache.models[providerName] = providerModels;
    } else {
      delete modelsCache.models[providerName];
    }

    modelsCache.providers = updatedProviders;
    const lastUpdated = updatedProviders.reduce<number>((acc, p) => {
      const t = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
      return t > acc ? t : acc;
    }, 0);
    modelsCache.lastUpdatedAt = lastUpdated;
    modelsCache.timestamp = Date.now();

    logger.info(`Updated provider ${providerName} in cache`);
  } catch (error) {
    logger.error(`Failed to update provider ${providerName} in cache:`, error);
    // Fallback to full cache invalidation
    invalidateModelsCache();
  }
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
      id: provider.id, // unique id
      provider: provider.name, // it indecates the model provider's interface type and icon
      alias: provider.alias, // service provider's real name
      models: (provider.llm || [])
        .filter((llm) => llm.enabled)
        .map((llm) => {
          const model = dynamicData.models[provider.name]?.[llm.id];
          const capabilities = model
            ? dynamicData.modelCapabilities.get(model)
            : undefined;
          const supportsFunctionCall =
            capabilities?.supportsFunctionCall ?? true;
          const supportsImageInput = capabilities?.supportsImageInput ?? false;
          return {
            name: llm.id, // model name
            type: llm.type, // Add LLM type (chat, vision, audio, agent)
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
