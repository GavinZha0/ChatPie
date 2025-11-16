import { agentGroupRepository } from "lib/db/repository";
import { getSession } from "auth/server";
import { notFound } from "next/navigation";
import { GroupsList } from "@/components/group/groups-list";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const session = await getSession();
  if (!session?.user.id) {
    notFound();
  }
  const groups = await agentGroupRepository.selectGroupsByUserId(
    session.user.id,
    50,
  );
  return <GroupsList initialGroups={groups} />;
}
