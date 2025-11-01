"use server";

import { llmRepository } from "lib/db/repository";
import { invalidateModelsCache } from "lib/ai/models";
import type { CreateLlmModel, UpdateLlmModel } from "app-types/llm";

/**
 * Get all LLM models.
 */
export async function getAllLlmsAction() {
  return llmRepository.selectAll();
}

/**
 * Get a single LLM model by its identifier.
 */
export async function getLlmByIdAction(id: string) {
  return llmRepository.selectById(id);
}

/**
 * Get all LLM models for a specific provider.
 */
export async function getLlmsByProviderAction(provider: string) {
  return llmRepository.selectByProvider(provider);
}

/**
 * Create a new LLM model and invalidate model cache.
 */
export async function saveLlmAction(model: CreateLlmModel) {
  const result = await llmRepository.save(model);
  invalidateModelsCache();
  return result;
}

/**
 * Update an existing LLM model and invalidate model cache on success.
 */
export async function updateLlmAction(
  id: string,
  provider: string,
  model: UpdateLlmModel,
) {
  const result = await llmRepository.update(id, provider, model);
  if (result) {
    invalidateModelsCache();
  }
  return result;
}

/**
 * Delete an LLM model and invalidate model cache.
 */
export async function deleteLlmAction(id: string) {
  await llmRepository.deleteById(id);
  invalidateModelsCache();
}
