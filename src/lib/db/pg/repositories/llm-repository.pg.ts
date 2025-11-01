import { and, eq } from "drizzle-orm";
import {
  LlmRepository,
  LlmModel,
  CreateLlmModel,
  UpdateLlmModel,
} from "app-types/llm";
import { pgDb as db } from "../db.pg";
import { LlmTable } from "../schema.pg";

type LlmInsert = typeof LlmTable.$inferInsert;

const applyCreateDefaults = (model: CreateLlmModel): LlmInsert => {
  const values: LlmInsert = {
    id: model.id,
    provider: model.provider,
  };

  if (model.type !== undefined) values.type = model.type;
  if (model.functionCall !== undefined)
    values.functionCall = model.functionCall;
  if (model.imageInput !== undefined) values.imageInput = model.imageInput;
  if (model.contextLimit !== undefined)
    values.contextLimit = model.contextLimit;
  values.updatedAt = new Date();

  return values;
};

const applyUpdatePatch = (model: UpdateLlmModel): Partial<LlmInsert> => {
  const values: Partial<LlmInsert> = {};

  if (model.type !== undefined) values.type = model.type;
  if (model.functionCall !== undefined)
    values.functionCall = model.functionCall;
  if (model.imageInput !== undefined) values.imageInput = model.imageInput;
  if (model.contextLimit !== undefined)
    values.contextLimit = model.contextLimit;
  values.updatedAt = new Date();

  return values;
};

export const pgLlmRepository: LlmRepository = {
  async selectAll(): Promise<LlmModel[]> {
    const rows = await db.select().from(LlmTable);
    return rows as LlmModel[];
  },

  async selectById(id: string): Promise<LlmModel | null> {
    const [row] = await db.select().from(LlmTable).where(eq(LlmTable.id, id));
    return (row as LlmModel) ?? null;
  },

  async selectByProvider(provider: string): Promise<LlmModel[]> {
    const rows = await db
      .select()
      .from(LlmTable)
      .where(eq(LlmTable.provider, provider));
    return rows as LlmModel[];
  },

  async save(model: CreateLlmModel): Promise<LlmModel> {
    const [row] = await db
      .insert(LlmTable)
      .values(applyCreateDefaults(model))
      .returning();
    return row as LlmModel;
  },

  async update(
    id: string,
    provider: string,
    model: UpdateLlmModel,
  ): Promise<LlmModel | null> {
    const [row] = await db
      .update(LlmTable)
      .set(applyUpdatePatch(model))
      .where(and(eq(LlmTable.id, id), eq(LlmTable.provider, provider)))
      .returning();
    return (row as LlmModel) ?? null;
  },

  async deleteById(id: string): Promise<void> {
    await db.delete(LlmTable).where(eq(LlmTable.id, id));
  },
};
