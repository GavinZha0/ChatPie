import { pgDb as db } from "../db.pg";
import { ProviderTable } from "../schema.pg";
import { eq, desc } from "drizzle-orm";
import type { LLMConfig } from "app-types/provider";

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
}

export const pgProviderRepository: ProviderRepository = {
  async selectAll() {
    const results = await db
      .select()
      .from(ProviderTable)
      .orderBy(desc(ProviderTable.updatedAt));
    return results;
  },

  async selectById(id) {
    const [result] = await db
      .select()
      .from(ProviderTable)
      .where(eq(ProviderTable.id, id));
    return result;
  },

  async selectByName(name) {
    const [result] = await db
      .select()
      .from(ProviderTable)
      .where(eq(ProviderTable.name, name));
    return result;
  },

  async save(provider) {
    if (provider.id) {
      // Update existing provider
      const [result] = await db
        .update(ProviderTable)
        .set({
          name: provider.name,
          alias: provider.alias,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey ?? null,
          llm: provider.llm ?? null,
          updatedAt: new Date(),
        })
        .where(eq(ProviderTable.id, provider.id))
        .returning();
      return result;
    } else {
      // Insert new provider
      const [result] = await db
        .insert(ProviderTable)
        .values({
          name: provider.name,
          alias: provider.alias,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey ?? null,
          llm: provider.llm ?? null,
        })
        .returning();
      return result;
    }
  },

  async updateApiKey(id, apiKey) {
    await db
      .update(ProviderTable)
      .set({ apiKey, updatedAt: new Date() })
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
};
