"use server";

import { providerRepository } from "lib/db/repository";
import { invalidateModelsCache } from "lib/ai/models";
import type { LLMConfig } from "app-types/provider";

/**
 * Update provider API key and invalidate models cache
 */
export async function updateProviderApiKeyAction(
  id: number,
  apiKey: string | null,
) {
  await providerRepository.updateApiKey(id, apiKey);
  invalidateModelsCache();
}

/**
 * Update provider LLM models and invalidate models cache
 */
export async function updateProviderLLMModelsAction(
  id: number,
  llm: LLMConfig[],
) {
  await providerRepository.updateLLMModels(id, llm);
  invalidateModelsCache();
}

/**
 * Save provider (create or update) and invalidate models cache
 */
export async function saveProviderAction(provider: {
  id?: number;
  name: string;
  alias: string;
  baseUrl: string;
  apiKey?: string | null;
  llm?: LLMConfig[] | null;
}) {
  const result = await providerRepository.save(provider);
  invalidateModelsCache();
  return result;
}

/**
 * Delete provider and invalidate models cache
 */
export async function deleteProviderAction(id: number) {
  await providerRepository.deleteById(id);
  invalidateModelsCache();
}

/**
 * Get all providers
 */
export async function getAllProvidersAction() {
  return await providerRepository.selectAll();
}

/**
 * Get provider by ID
 */
export async function getProviderByIdAction(id: number) {
  return await providerRepository.selectById(id);
}
