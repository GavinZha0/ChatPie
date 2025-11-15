import { agentGroupRepository } from "lib/db/repository";
import { getSession } from "auth/server";
import { z } from "zod";
import {
  AgentGroupCreateSchema,
  AgentGroupQuerySchema,
} from "app-types/agent-group";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const { limit } = AgentGroupQuerySchema.parse(queryParams);
    const groups = await agentGroupRepository.selectGroupsByUserId(
      session.user.id,
      limit,
    );
    return Response.json(groups);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid query parameters", details: error.message },
        { status: 400 },
      );
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const body = await request.json();
    const data = AgentGroupCreateSchema.parse(body);
    const group = await agentGroupRepository.createGroup({
      ...data,
      userId: session.user.id,
    });
    return Response.json(group);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid input", details: error.message },
        { status: 400 },
      );
    }
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
