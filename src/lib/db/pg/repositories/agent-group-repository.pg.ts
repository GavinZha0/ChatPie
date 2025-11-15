import { and, desc, eq } from "drizzle-orm";
import { pgDb as db } from "../db.pg";
import { AgentGroupTable } from "../schema.pg";
import type { AgentGroup, AgentGroupRepository } from "app-types/agent-group";

export const pgAgentGroupRepository: AgentGroupRepository = {
  async createGroup(group) {
    const [result] = await db
      .insert(AgentGroupTable)
      .values({
        name: group.name,
        userId: group.userId,
        description: group.description ?? null,
        agentIds: group.agentIds ?? [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      ...result,
      description: result.description ?? undefined,
      agentIds: result.agentIds ?? [],
    } as AgentGroup;
  },

  async selectGroupById(id, userId) {
    const [result] = await db
      .select()
      .from(AgentGroupTable)
      .where(
        and(eq(AgentGroupTable.id, id), eq(AgentGroupTable.userId, userId)),
      );
    if (!result) return null;
    return {
      ...result,
      description: result.description ?? undefined,
      agentIds: result.agentIds ?? [],
    } as AgentGroup;
  },

  async selectGroupsByUserId(userId, limit = 50) {
    const results = await db
      .select()
      .from(AgentGroupTable)
      .where(eq(AgentGroupTable.userId, userId))
      .orderBy(desc(AgentGroupTable.updatedAt))
      .limit(limit);
    return results.map((row) => ({
      ...row,
      description: row.description ?? undefined,
      agentIds: row.agentIds ?? [],
    })) as AgentGroup[];
  },

  async updateGroup(id, userId, data) {
    const updateValues: Partial<typeof AgentGroupTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) {
      updateValues.name = data.name;
    }
    if (data.description !== undefined) {
      updateValues.description = data.description ?? null;
    }
    if (data.agentIds !== undefined) {
      updateValues.agentIds = data.agentIds ?? [];
    }

    const [result] = await db
      .update(AgentGroupTable)
      .set(updateValues)
      .where(
        and(eq(AgentGroupTable.id, id), eq(AgentGroupTable.userId, userId)),
      )
      .returning();

    return {
      ...result,
      description: result.description ?? undefined,
      agentIds: result.agentIds ?? [],
    } as AgentGroup;
  },

  async deleteGroup(id, userId) {
    await db
      .delete(AgentGroupTable)
      .where(
        and(eq(AgentGroupTable.id, id), eq(AgentGroupTable.userId, userId)),
      );
  },

  async addAgent(id, userId, agentId) {
    const current = await this.selectGroupById(id, userId);
    const nextIds = Array.from(
      new Set([...(current?.agentIds || []), agentId]),
    );
    return await this.updateGroup(id, userId, { agentIds: nextIds });
  },

  async removeAgent(id, userId, agentId) {
    const current = await this.selectGroupById(id, userId);
    const nextIds = (current?.agentIds || []).filter((a) => a !== agentId);
    return await this.updateGroup(id, userId, { agentIds: nextIds });
  },
};
