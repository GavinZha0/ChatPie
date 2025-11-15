import z from "zod";

export const AgentGroupCreateSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(8000).optional(),
    agentIds: z.array(z.string()).optional().default([]),
  })
  .strip();

export const AgentGroupUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(8000).optional(),
    agentIds: z.array(z.string()).optional(),
  })
  .strip();

export const AgentGroupQuerySchema = z
  .object({
    limit: z.coerce.number().min(1).max(100).default(50),
  })
  .strip();

export type AgentGroup = {
  id: number;
  name: string;
  agentIds: string[];
  description?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface AgentGroupRepository {
  createGroup(group: {
    userId: string;
    name: string;
    description?: string;
    agentIds?: string[];
  }): Promise<AgentGroup>;

  selectGroupById(id: number, userId: string): Promise<AgentGroup | null>;

  selectGroupsByUserId(userId: string, limit?: number): Promise<AgentGroup[]>;

  updateGroup(
    id: number,
    userId: string,
    data: { name?: string; description?: string; agentIds?: string[] },
  ): Promise<AgentGroup>;

  deleteGroup(id: number, userId: string): Promise<void>;

  addAgent(id: number, userId: string, agentId: string): Promise<AgentGroup>;

  removeAgent(id: number, userId: string, agentId: string): Promise<AgentGroup>;
}
