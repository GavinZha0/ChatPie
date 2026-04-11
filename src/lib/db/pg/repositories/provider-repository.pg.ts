import { pgDb as db } from "../db.pg";
import { ProviderTable } from "../schema.pg";
import { eq, desc } from "drizzle-orm";
import type { LLMConfig } from "app-types/provider";
import { encryptApiKey, decryptApiKey } from "lib/crypto/api-key-cipher";

/** Safely decrypt a nullable api_key field from the database. */
function decryptKey(apiKey: string | null): string | null {
  if (!apiKey) return apiKey;
  return decryptApiKey(apiKey);
}

/** Safely encrypt a nullable api_key before writing to the database. */
function encryptKey(apiKey: string | null | undefined): string | null {
  if (!apiKey) return apiKey ?? null;
  return encryptApiKey(apiKey);
}

export interface ProviderRepository {
  /**
   * Get all providers
   */
  selectAll(): Promise<
    Array<{
      id: number;
      name: string;
      alias: string;
      baseUrl: string;
      apiKey: string | null;
      llm: LLMConfig[] | null;
      updatedAt: Date;
    }>
  >;

  /**
   * Get provider by ID
   */
  selectById(id: number): Promise<
    | {
        id: number;
        name: string;
        alias: string;
        baseUrl: string;
        apiKey: string | null;
        llm: LLMConfig[] | null;
        updatedAt: Date;
      }
    | undefined
  >;

  /**
   * Get provider by name
   */
  selectByName(name: string): Promise<
    | {
        id: number;
        name: string;
        alias: string;
        baseUrl: string;
        apiKey: string | null;
        llm: LLMConfig[] | null;
        updatedAt: Date;
      }
    | undefined
  >;

  /**
   * Create or update a provider
   */
  save(provider: {
    id?: number;
    name: string;
    alias: string;
    baseUrl: string;
    apiKey?: string | null;
    llm?: LLMConfig[] | null;
  }): Promise<{
    id: number;
    name: string;
    alias: string;
    baseUrl: string;
    apiKey: string | null;
    llm: LLMConfig[] | null;
    updatedAt: Date;
  }>;

  /**
   * Update provider API key
   */
  updateApiKey(id: number, apiKey: string | null): Promise<void>;

  /**
   * Update provider LLM models
   */
  updateLLMModels(id: number, llm: LLMConfig[]): Promise<void>;

  /**
   * Delete provider by ID
   */
  deleteById(id: number): Promise<void>;

  /**
   * Check if provider exists by name
   */
  existsByName(name: string): Promise<boolean>;

  latestUpdatedAt(): Promise<Date | null>;
}

export const pgProviderRepository: ProviderRepository = {
  async selectAll() {
    const results = await db
      .select()
      .from(ProviderTable)
      .orderBy(desc(ProviderTable.updatedAt));
    return results.map((r) => ({ ...r, apiKey: decryptKey(r.apiKey) }));
  },

  async selectById(id) {
    const [result] = await db
      .select()
      .from(ProviderTable)
      .where(eq(ProviderTable.id, id));
    if (!result) return result;
    return { ...result, apiKey: decryptKey(result.apiKey) };
  },

  async selectByName(name) {
    const results = await db
      .select()
      .from(ProviderTable)
      .where(eq(ProviderTable.name, name))
      .orderBy(desc(ProviderTable.updatedAt));
    const decrypted = results.map((r) => ({
      ...r,
      apiKey: decryptKey(r.apiKey),
    }));
    const withKey = decrypted.find(
      (p) => typeof p.apiKey === "string" && p.apiKey.trim().length > 0,
    );
    return withKey ?? decrypted[0];
  },

  async save(provider) {
    const encryptedKey = encryptKey(provider.apiKey);
    if (provider.id) {
      // Update existing provider
      const [result] = await db
        .update(ProviderTable)
        .set({
          name: provider.name,
          alias: provider.alias,
          baseUrl: provider.baseUrl,
          apiKey: encryptedKey,
          llm: provider.llm ?? null,
          updatedAt: new Date(),
        })
        .where(eq(ProviderTable.id, provider.id))
        .returning();
      return { ...result, apiKey: decryptKey(result.apiKey) };
    } else {
      // Insert new provider
      const [result] = await db
        .insert(ProviderTable)
        .values({
          name: provider.name,
          alias: provider.alias,
          baseUrl: provider.baseUrl,
          apiKey: encryptedKey,
          llm: provider.llm ?? null,
        })
        .returning();
      return { ...result, apiKey: decryptKey(result.apiKey) };
    }
  },

  async updateApiKey(id, apiKey) {
    await db
      .update(ProviderTable)
      .set({ apiKey: encryptKey(apiKey), updatedAt: new Date() })
      .where(eq(ProviderTable.id, id));
  },

  async updateLLMModels(id, llm) {
    await db
      .update(ProviderTable)
      .set({ llm, updatedAt: new Date() })
      .where(eq(ProviderTable.id, id));
  },

  async deleteById(id) {
    await db.delete(ProviderTable).where(eq(ProviderTable.id, id));
  },

  async existsByName(name) {
    const [result] = await db
      .select({ id: ProviderTable.id })
      .from(ProviderTable)
      .where(eq(ProviderTable.name, name));

    return !!result;
  },

  async latestUpdatedAt() {
    const [result] = await db
      .select({ updatedAt: ProviderTable.updatedAt })
      .from(ProviderTable)
      .orderBy(desc(ProviderTable.updatedAt))
      .limit(1);
    return result?.updatedAt ?? null;
  },
};
