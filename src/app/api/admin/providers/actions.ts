"use server";

import { providerRepository } from "lib/db/repository";
import { invalidateModelsCache } from "lib/ai/models";
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
  await requireAdminPermission();
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
  await requireAdminPermission();
  const result = await providerRepository.save(provider);
  invalidateModelsCache();
  return result;
}

/**
 * Delete provider and invalidate models cache
 */
export async function deleteProviderAction(id: number) {
  await requireAdminPermission();
  await providerRepository.deleteById(id);
  invalidateModelsCache();
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
