import { redirect } from "next/navigation";
import { requireAdminPermission } from "auth/permissions";
import { getSession } from "lib/auth/server";
import { Providers } from "@/components/admin/providers";
import { getAllProvidersAction } from "@/app/api/admin/providers/actions";
import AdminUnauthorized from "../unauthorized";

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

  // Build llmMap from providers' llm configs
  const llmMap = new Map<string, import("app-types/provider").LLMConfig>();
  for (const p of providers) {
    for (const m of p.llm ?? []) {
      llmMap.set(`${p.id}:${m.id}`, m);
    }
  }

  return <Providers providers={providers} llmMap={llmMap} />;
}
