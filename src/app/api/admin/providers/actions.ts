"use server";

import { providerRepository } from "lib/db/repository";
import { updateProviderInCache } from "lib/ai/models";
import { invalidateExaConfigCache } from "lib/ai/tools/web/web-search";
import type { LLMConfig } from "app-types/provider";
import { requireAdminPermission } from "auth/permissions";

/**
 * Update provider API key and invalidate models cache
 */
export async function updateProviderApiKeyAction(
  id: number,
  apiKey: string | null,
) {
  await requireAdminPermission();
  const provider = await providerRepository.selectById(id);
  if (provider) {
    await providerRepository.updateApiKey(id, apiKey);
    await updateProviderInCache(provider.name);
    if (provider.name === "exa") {
      invalidateExaConfigCache();
    }
  }
}

/**
 * Update provider LLM models and invalidate models cache
 */
export async function updateProviderLLMModelsAction(
  id: number,
  llm: LLMConfig[],
) {
  await requireAdminPermission();
  const provider = await providerRepository.selectById(id);
  if (provider) {
    await providerRepository.updateLLMModels(id, llm);
    await updateProviderInCache(provider.name);
  }
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
  await requireAdminPermission();
  const result = await providerRepository.save(provider);
  await updateProviderInCache(provider.name);
  if (provider.name === "exa") {
    invalidateExaConfigCache();
  }
  return result;
}

/**
 * Delete provider and invalidate models cache
 */
export async function deleteProviderAction(id: number) {
  await requireAdminPermission();
  const provider = await providerRepository.selectById(id);
  if (provider) {
    await providerRepository.deleteById(id);
    await updateProviderInCache(provider.name);
    if (provider.name === "exa") {
      invalidateExaConfigCache();
    }
  }
}

/**
 * Get all providers
 */
export async function getAllProvidersAction() {
  await requireAdminPermission();
  return await providerRepository.selectAll();
}

/**
 * Get provider by ID
 */
export async function getProviderByIdAction(id: number) {
  await requireAdminPermission();
  return await providerRepository.selectById(id);
}

export async function getProviderByNameAction(name: string) {
  await requireAdminPermission();
  return await providerRepository.selectByName(name);
}
