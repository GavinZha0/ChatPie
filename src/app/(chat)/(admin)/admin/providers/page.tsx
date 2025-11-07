import { redirect } from "next/navigation";
import { requireAdminPermission } from "auth/permissions";
import { getSession } from "lib/auth/server";
import { Providers } from "@/components/admin/providers";
import { getAllProvidersAction } from "@/app/api/provider/actions";
import { llmRepository } from "lib/db/repository";
import AdminUnauthorized from "../../unauthorized";

// Force dynamic rendering to avoid static generation issues with session
export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  try {
    await requireAdminPermission();
  } catch (_error) {
    return <AdminUnauthorized />;
  }

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Get all providers from database
  const providers = await getAllProvidersAction();

  // Get all LLM models from database for context limit info
  const allLlms = await llmRepository.selectAll();

  // Create a map of model id -> LlmModel for quick lookup
  // Use lowercase provider name to match llm table format
  const llmMap = new Map(
    allLlms.map((llm) => [`${llm.provider.toLowerCase()}:${llm.id}`, llm]),
  );

  return <Providers providers={providers} llmMap={llmMap} />;
}
