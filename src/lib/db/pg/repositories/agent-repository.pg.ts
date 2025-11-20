import { Agent, AgentRepository, AgentSummary } from "app-types/agent";
import { pgDb as db } from "../db.pg";
import { AgentTable, BookmarkTable, UserTable } from "../schema.pg";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { generateUUID } from "lib/utils";
import { CacheKeys } from "lib/cache/cache-keys";
import { serverCache } from "lib/cache";

export const pgAgentRepository: AgentRepository = {
  async insertAgent(agent) {
    const now = new Date();
    if (!agent.model) {
      throw new Error("Agent model is required");
    }

    const values: Partial<typeof AgentTable.$inferInsert> = {
      id: generateUUID(),
      name: agent.name,
      description: agent.description ?? null,
      icon: agent.icon ?? null,
      userId: agent.userId,
      role: agent.role ?? null,
      systemPrompt: agent.systemPrompt ?? null,
      tools: agent.tools ?? null,
      model: agent.model,
      visibility: agent.visibility || "private",
      createdAt: now,
      updatedAt: now,
    };
    const [result] = await db
      .insert(AgentTable)
      .values(values as typeof AgentTable.$inferInsert)
      .returning();

    return {
      ...result,
      description: result.description ?? undefined,
      icon: result.icon ?? undefined,
      role: result.role ?? undefined,
      systemPrompt: result.systemPrompt ?? undefined,
      tools: result.tools ?? undefined,
      model: result.model ?? undefined,
    };
  },

  async selectAgentById(id, userId): Promise<Agent | null> {
    const [result] = await db
      .select({
        id: AgentTable.id,
        name: AgentTable.name,
        description: AgentTable.description,
        icon: AgentTable.icon,
        userId: AgentTable.userId,
        role: AgentTable.role,
        systemPrompt: AgentTable.systemPrompt,
        tools: AgentTable.tools,
        model: AgentTable.model,
        visibility: AgentTable.visibility,
        createdAt: AgentTable.createdAt,
        updatedAt: AgentTable.updatedAt,
        isBookmarked: sql<boolean>`${BookmarkTable.id} IS NOT NULL`,
      })
      .from(AgentTable)
      .leftJoin(
        BookmarkTable,
        and(
          eq(BookmarkTable.itemId, AgentTable.id),
          eq(BookmarkTable.userId, userId),
          eq(BookmarkTable.itemType, "agent"),
        ),
      )
      .where(
        and(
          eq(AgentTable.id, id),
          or(
            eq(AgentTable.userId, userId), // Own agent
            eq(AgentTable.visibility, "public"), // Public agent
            eq(AgentTable.visibility, "readonly"), // Readonly agent
          ),
        ),
      );

    if (!result) return null;

    return {
      ...result,
      description: result.description ?? undefined,
      icon: result.icon ?? undefined,
      role: result.role ?? undefined,
      systemPrompt: result.systemPrompt ?? undefined,
      tools: result.tools ?? undefined,
      model: result.model ?? undefined,
      isBookmarked: result.isBookmarked ?? false,
    };
  },

  async selectAgentsByUserId(userId) {
    const results = await db
      .select({
        id: AgentTable.id,
        name: AgentTable.name,
        description: AgentTable.description,
        icon: AgentTable.icon,
        userId: AgentTable.userId,
        role: AgentTable.role,
        systemPrompt: AgentTable.systemPrompt,
        tools: AgentTable.tools,
        model: AgentTable.model,
        visibility: AgentTable.visibility,
        createdAt: AgentTable.createdAt,
        updatedAt: AgentTable.updatedAt,
        userName: UserTable.name,
        userAvatar: UserTable.image,
        isBookmarked: sql<boolean>`false`,
      })
      .from(AgentTable)
      .innerJoin(UserTable, eq(AgentTable.userId, UserTable.id))
      .where(eq(AgentTable.userId, userId))
      .orderBy(desc(AgentTable.createdAt));

    // Map database nulls to undefined and set defaults for owned agents
    return results.map((result) => ({
      ...result,
      description: result.description ?? undefined,
      icon: result.icon ?? undefined,
      role: result.role ?? undefined,
      systemPrompt: result.systemPrompt ?? undefined,
      tools: result.tools ?? undefined,
      model: result.model ?? undefined,
      userName: result.userName ?? undefined,
      userAvatar: result.userAvatar ?? undefined,
      isBookmarked: false, // Always false for owned agents
    }));
  },

  async updateAgent(id, userId, agent) {
    const updateData: Partial<typeof AgentTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (agent.name !== undefined) updateData.name = agent.name;
    if (agent.description !== undefined)
      updateData.description = agent.description ?? null;
    if (agent.icon !== undefined) updateData.icon = agent.icon ?? null;
    if (agent.role !== undefined) updateData.role = agent.role ?? null;
    if (agent.systemPrompt !== undefined)
      updateData.systemPrompt = agent.systemPrompt ?? null;
    if (agent.tools !== undefined) updateData.tools = agent.tools ?? null;
    if (agent.model !== undefined) updateData.model = agent.model;
    if (agent.visibility !== undefined)
      updateData.visibility = agent.visibility;

    const [result] = await db
      .update(AgentTable)
      .set(updateData as typeof AgentTable.$inferInsert)
      .where(
        and(
          // Only allow updates to agents owned by the user or public agents
          eq(AgentTable.id, id),
          or(
            eq(AgentTable.userId, userId),
            eq(AgentTable.visibility, "public"),
          ),
        ),
      )
      .returning();

    await serverCache.delete(CacheKeys.agent(id));

    return {
      ...result,
      description: result.description ?? undefined,
      icon: result.icon ?? undefined,
      role: result.role ?? undefined,
      systemPrompt: result.systemPrompt ?? undefined,
      tools: result.tools ?? undefined,
      model: result.model ?? undefined,
    };
  },

  async deleteAgent(id, userId) {
    await db
      .delete(AgentTable)
      .where(and(eq(AgentTable.id, id), eq(AgentTable.userId, userId)));
    await serverCache.delete(CacheKeys.agent(id));
  },

  async selectAgents(
    currentUserId,
    filters = ["all"],
    limit = 50,
  ): Promise<AgentSummary[]> {
    let orConditions: any[] = [];

    // Build OR conditions based on filters array
    for (const filter of filters) {
      if (filter === "mine") {
        orConditions.push(eq(AgentTable.userId, currentUserId));
      } else if (filter === "shared") {
        orConditions.push(
          and(
            ne(AgentTable.userId, currentUserId),
            or(
              eq(AgentTable.visibility, "public"),
              eq(AgentTable.visibility, "readonly"),
            ),
          ),
        );
      } else if (filter === "bookmarked") {
        orConditions.push(
          and(
            ne(AgentTable.userId, currentUserId),
            or(
              eq(AgentTable.visibility, "public"),
              eq(AgentTable.visibility, "readonly"),
            ),
            sql`${BookmarkTable.id} IS NOT NULL`,
          ),
        );
      } else if (filter === "all") {
        // All available agents (mine + shared) - this overrides other filters
        orConditions = [
          or(
            // My agents
            eq(AgentTable.userId, currentUserId),
            // Shared agents
            and(
              ne(AgentTable.userId, currentUserId),
              or(
                eq(AgentTable.visibility, "public"),
                eq(AgentTable.visibility, "readonly"),
              ),
            ),
          ),
        ];
        break; // "all" overrides everything else
      }
    }

    const results = await db
      .select({
        id: AgentTable.id,
        name: AgentTable.name,
        description: AgentTable.description,
        icon: AgentTable.icon,
        userId: AgentTable.userId,
        role: AgentTable.role,
        systemPrompt: AgentTable.systemPrompt,
        tools: AgentTable.tools,
        model: AgentTable.model,
        visibility: AgentTable.visibility,
        createdAt: AgentTable.createdAt,
        updatedAt: AgentTable.updatedAt,
        userName: UserTable.name,
        userAvatar: UserTable.image,
        isBookmarked: sql<boolean>`CASE WHEN ${BookmarkTable.id} IS NOT NULL THEN true ELSE false END`,
      })
      .from(AgentTable)
      .innerJoin(UserTable, eq(AgentTable.userId, UserTable.id))
      .leftJoin(
        BookmarkTable,
        and(
          eq(BookmarkTable.itemId, AgentTable.id),
          eq(BookmarkTable.itemType, "agent"),
          eq(BookmarkTable.userId, currentUserId),
        ),
      )
      .where(orConditions.length > 1 ? or(...orConditions) : orConditions[0])
      .orderBy(
        // My agents first, then other shared agents
        sql`CASE WHEN ${AgentTable.userId} = ${currentUserId} THEN 0 ELSE 1 END`,
        desc(AgentTable.createdAt),
      )
      .limit(limit);

    // Map database nulls to undefined and assemble chatModel
    return results.map((result) => ({
      id: result.id,
      name: result.name,
      description: result.description ?? undefined,
      icon: result.icon ?? undefined,
      userId: result.userId,
      role: result.role ?? undefined,
      systemPrompt: result.systemPrompt ?? undefined,
      tools: result.tools ?? undefined,
      model: result.model ?? undefined,
      visibility: result.visibility,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      userName: result.userName ?? undefined,
      userAvatar: result.userAvatar ?? undefined,
      isBookmarked: result.isBookmarked ?? false,
    }));
  },

  async checkAccess(agentId, userId, destructive = false) {
    const [agent] = await db
      .select({
        visibility: AgentTable.visibility,
        userId: AgentTable.userId,
      })
      .from(AgentTable)
      .where(eq(AgentTable.id, agentId));
    if (!agent) {
      return false;
    }
    if (userId == agent.userId) return true;
    if (agent.visibility === "public" && !destructive) return true;
    return false;
  },
};
