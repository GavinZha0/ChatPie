import { ChatModel } from "app-types/chat";
import { Provider, LLMConfig } from "app-types/provider";
import { providerRepository } from "lib/db/repository";

// Independent cache for audio model configuration
type AudioModelCache = {
  provider: Provider;
  llmConfig: LLMConfig;
  timestamp: number;
} | null;

const audioModelCache = new Map<string, AudioModelCache>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get audio model provider configuration
 * @param audioModel User selected audio model
 * @returns Provider and LLMConfig if available, null otherwise
 */
export async function getAudioModelProvider(audioModel: ChatModel): Promise<{
  provider: Provider;
  llmConfig: LLMConfig;
} | null> {
  const cacheKey = `${audioModel.provider}:${audioModel.model}`;

  // Check cache first
  const cached = audioModelCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { provider: cached.provider, llmConfig: cached.llmConfig };
  }

  // Query database for matching provider
  const provider = await providerRepository.selectByName(audioModel.provider);

  if (!provider) {
    // Not found, cache null to avoid repeated queries
    audioModelCache.set(cacheKey, null);
    return null;
  }

  // Find matching audio model configuration
  const llmConfig = provider.llm?.find(
    (llm) =>
      llm.id === audioModel.model &&
      llm.type === "audio" &&
      llm.enabled === true,
  );

  // Verify valid configuration (model found and API key exists)
  if (!llmConfig || !provider.apiKey) {
    // Not found, cache null to avoid repeated queries
    audioModelCache.set(cacheKey, null);
    return null;
  }

  const result = { provider, llmConfig };

  // Update cache
  audioModelCache.set(cacheKey, {
    ...result,
    timestamp: Date.now(),
  });

  return result;
}

/**
 * Invalidate audio model cache (called when provider is updated)
 * @param providerName Optional provider name to clear specific cache
 */
export function invalidateAudioModelCache(providerName?: string) {
  if (providerName) {
    // Clear cache for specific provider
    for (const key of audioModelCache.keys()) {
      if (key.startsWith(`${providerName}:`)) {
        audioModelCache.delete(key);
      }
    }
  } else {
    // Clear all cache
    audioModelCache.clear();
  }
}
