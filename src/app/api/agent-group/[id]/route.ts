import { agentGroupRepository } from "lib/db/repository";
import { getSession } from "auth/server";
import { z } from "zod";
import { AgentGroupUpdateSchema } from "app-types/agent-group";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const group = await agentGroupRepository.selectGroupById(
    Number(id),
    session.user.id,
  );
  if (!group) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(group);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const data = AgentGroupUpdateSchema.parse(body);
    const group = await agentGroupRepository.updateGroup(
      Number(id),
      session.user.id,
      data,
    );
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  await agentGroupRepository.deleteGroup(Number(id), session.user.id);
  return Response.json({ success: true });
}
