import { agentRepository } from "lib/db/repository";
import { getSession } from "auth/server";
import { z } from "zod";
import { AgentUpdateSchema } from "app-types/agent";
import { serverCache } from "lib/cache";
import { CacheKeys } from "lib/cache/cache-keys";
import { canEditAgent, canDeleteAgent } from "lib/auth/permissions";
import { shareMcpServerAction } from "@/app/api/mcp/actions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session?.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const hasAccess = await agentRepository.checkAccess(id, session.user.id);
  if (!hasAccess) {
    return new Response("Unauthorized", { status: 401 });
  }

  const agent = await agentRepository.selectAgentById(id, session.user.id);
  return Response.json(agent);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user has permission to edit agents
  const canEdit = await canEditAgent();
  if (!canEdit) {
    return NextResponse.json(
      { error: "Only editors and admins can edit agents" },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Check for confirmation flag
    const { confirmPromotion, ...updateData } = body;
    const data = AgentUpdateSchema.parse(updateData);

    // Check access for write operations
    const hasAccess = await agentRepository.checkAccess(id, session.user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current agent to check visibility change
    const existingAgent = await agentRepository.selectAgentById(
      id,
      session.user.id,
    );

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // For non-owners of public agents, preserve original visibility
    if (existingAgent && existingAgent.userId !== session.user.id) {
      data.visibility = existingAgent.visibility;
    }

    // Check if visibility is changing
    const isChangingToPublic =
      data.visibility === "public" && existingAgent.visibility !== "public";
    const isChangingToPrivate =
      data.visibility === "private" && existingAgent.visibility !== "private";

    if (isChangingToPublic && existingAgent.tools) {
      // Extract MCP servers and workflows from agent tools
      const mcpServerIds = existingAgent.tools
        .filter((tool) => tool.type === "mcpServer")
        .map((tool) => tool.serverId)
        .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

      // Extract MCP server IDs from mcpTool type as well
      const mcpToolServerIds = existingAgent.tools
        .filter((tool) => tool.type === "mcpTool")
        .map((tool) => tool.serverId)
        .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

      // Combine all MCP server IDs
      const allMcpServerIds = [...mcpServerIds, ...mcpToolServerIds].filter(
        (id, index, arr) => arr.indexOf(id) === index,
      ); // Remove duplicates

      const workflowIds = existingAgent.tools
        .filter((tool) => tool.type === "workflow")
        .map((tool) => tool.workflowId)
        .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

      // If there are resources to promote and no confirmation flag, require client confirmation
      if (
        (allMcpServerIds.length > 0 || workflowIds.length > 0) &&
        !confirmPromotion
      ) {
        // Return a special response code to trigger client-side confirmation dialog
        return NextResponse.json(
          {
            requiresConfirmation: true,
            action: "promote",
            mcpServersCount: allMcpServerIds.length,
            workflowsCount: workflowIds.length,
            mcpServerIds: allMcpServerIds,
            workflowIds,
            agentData: {
              id: existingAgent.id,
              name: existingAgent.name,
              visibility: data.visibility,
            },
          },
          { status: 202 },
        ); // Use 202 to indicate accepted but requires confirmation
      }

      // Proceed with promotion when confirmation is provided
      if (confirmPromotion) {
        try {
          if (allMcpServerIds.length > 0) {
            for (const serverId of allMcpServerIds) {
              await shareMcpServerAction(serverId, "public");
            }
            console.log(
              `Promoted ${allMcpServerIds.length} MCP servers to public:`,
              allMcpServerIds,
            );
          }

          if (workflowIds.length > 0) {
            for (const workflowId of workflowIds) {
              // TODO: Implement workflow promotion API call
              console.log(`Should promote workflow ${workflowId} to public`);
            }
            console.log(
              `Found ${workflowIds.length} workflows to promote to public:`,
              workflowIds,
            );
          }
        } catch (error) {
          console.error("Failed to promote resources:", error);
          // Continue with agent update even if promotion fails
        }
      }
    }

    // Handle demotion to private
    if (isChangingToPrivate && existingAgent.tools) {
      // Extract MCP servers and workflows from agent tools
      const mcpServerIds = existingAgent.tools
        .filter((tool) => tool.type === "mcpServer")
        .map((tool) => tool.serverId)
        .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

      // Extract MCP server IDs from mcpTool type as well
      const mcpToolServerIds = existingAgent.tools
        .filter((tool) => tool.type === "mcpTool")
        .map((tool) => tool.serverId)
        .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

      // Combine all MCP server IDs
      const allMcpServerIds = [...mcpServerIds, ...mcpToolServerIds].filter(
        (id, index, arr) => arr.indexOf(id) === index,
      ); // Remove duplicates

      const workflowIds = existingAgent.tools
        .filter((tool) => tool.type === "workflow")
        .map((tool) => tool.workflowId)
        .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

      // Check which resources can be demoted (not used by other public agents)
      const demotableMcpServers: string[] = [];
      const demotableWorkflows: string[] = [];

      if (allMcpServerIds.length > 0) {
        for (const serverId of allMcpServerIds) {
          // Check if this MCP server is used by other public agents
          const otherPublicAgents = await agentRepository.selectAgents(
            session.user.id,
            ["shared"],
          );
          const isUsedByOtherPublic = otherPublicAgents.some(
            (agent) =>
              agent.id !== existingAgent.id &&
              agent.visibility === "public" &&
              agent.tools?.some(
                (tool) =>
                  (tool.type === "mcpServer" && tool.serverId === serverId) ||
                  (tool.type === "mcpTool" && tool.serverId === serverId),
              ),
          );

          console.log(
            `MCP Server ${serverId} used by other public agents: ${isUsedByOtherPublic}`,
          );

          if (!isUsedByOtherPublic) {
            demotableMcpServers.push(serverId);
            console.log(
              `MCP Server ${serverId} can be demoted (not used by other public agents)`,
            );
          }
        }
      }

      if (workflowIds.length > 0) {
        for (const workflowId of workflowIds) {
          // Check if this workflow is used by other public agents
          const otherPublicAgents = await agentRepository.selectAgents(
            session.user.id,
            ["shared"],
          );
          const isUsedByOtherPublic = otherPublicAgents.some(
            (agent) =>
              agent.id !== existingAgent.id &&
              agent.visibility === "public" &&
              agent.tools?.some(
                (tool) =>
                  tool.type === "workflow" && tool.workflowId === workflowId,
              ),
          );

          console.log(
            `Workflow ${workflowId} used by other public agents: ${isUsedByOtherPublic}`,
          );

          if (!isUsedByOtherPublic) {
            demotableWorkflows.push(workflowId);
            console.log(
              `Workflow ${workflowId} can be demoted (not used by other public agents)`,
            );
          }
        }
      }

      if (
        (demotableMcpServers.length > 0 || demotableWorkflows.length > 0) &&
        !confirmPromotion
      ) {
        return NextResponse.json(
          {
            requiresConfirmation: true,
            action: "demote",
            mcpServersCount: demotableMcpServers.length,
            workflowsCount: demotableWorkflows.length,
            mcpServerIds: demotableMcpServers,
            workflowIds: demotableWorkflows,
            agentData: {
              id: existingAgent.id,
              name: existingAgent.name,
              visibility: data.visibility,
            },
          },
          { status: 202 },
        );
      }

      // Proceed with demotion when confirmation is provided
      if (confirmPromotion) {
        try {
          if (demotableMcpServers.length > 0) {
            for (const serverId of demotableMcpServers) {
              await shareMcpServerAction(serverId, "private");
            }
            console.log(
              `Demoted ${demotableMcpServers.length} MCP servers to private:`,
              demotableMcpServers,
            );
          }

          if (demotableWorkflows.length > 0) {
            for (const workflowId of demotableWorkflows) {
              // TODO: Implement workflow demotion API call
              console.log(`Should demote workflow ${workflowId} to private`);
            }
            console.log(
              `Found ${demotableWorkflows.length} workflows to demote to private:`,
              demotableWorkflows,
            );
          }
        } catch (error) {
          console.error("Failed to demote resources:", error);
          // Continue with agent update even if demotion fails
        }
      }
    }

    const agent = await agentRepository.updateAgent(id, session.user.id, data);
    serverCache.delete(CacheKeys.agent(agent.id));

    return NextResponse.json(agent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.message },
        { status: 400 },
      );
    }

    console.error("Failed to update agent:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session?.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check if user has permission to delete agents
  const canDelete = await canDeleteAgent();
  if (!canDelete) {
    return Response.json(
      { error: "Only editors and admins can delete agents" },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    const hasAccess = await agentRepository.checkAccess(
      id,
      session.user.id,
      true, // destructive = true for delete operations
    );
    if (!hasAccess) {
      return new Response("Unauthorized", { status: 401 });
    }
    await agentRepository.deleteAgent(id, session.user.id);
    serverCache.delete(CacheKeys.agent(id));
    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
