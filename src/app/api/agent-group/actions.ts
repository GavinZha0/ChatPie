"use server";

import { getSession } from "auth/server";
import { agentGroupRepository } from "lib/db/repository";
import {
  AgentGroupCreateSchema,
  AgentGroupUpdateSchema,
} from "app-types/agent-group";

async function getUserId() {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("User not found");
  }
  return userId;
}

export async function getMyAgentGroupsAction(limit = 50) {
  const userId = await getUserId();
  return await agentGroupRepository.selectGroupsByUserId(userId, limit);
}

export async function createAgentGroupAction(data: {
  name: string;
  description?: string;
  agentIds?: string[];
}) {
  const userId = await getUserId();
  const validated = AgentGroupCreateSchema.parse(data);
  return await agentGroupRepository.createGroup({
    ...validated,
    userId,
  });
}

export async function updateAgentGroupAction(
  id: number,
  data: {
    name?: string;
    description?: string;
    agentIds?: string[];
  },
) {
  const userId = await getUserId();
  const validated = AgentGroupUpdateSchema.parse(data);
  return await agentGroupRepository.updateGroup(id, userId, validated);
}

export async function deleteAgentGroupAction(id: number) {
  const userId = await getUserId();
  await agentGroupRepository.deleteGroup(id, userId);
}

export async function addAgentToGroupAction(id: number, agentId: string) {
  const userId = await getUserId();
  return await agentGroupRepository.addAgent(id, userId, agentId);
}

export async function removeAgentFromGroupAction(id: number, agentId: string) {
  const userId = await getUserId();
  return await agentGroupRepository.removeAgent(id, userId, agentId);
}
