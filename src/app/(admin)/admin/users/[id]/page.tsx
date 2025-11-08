import { getUser } from "lib/user/server";
import { UsersTable } from "@/components/admin/users-table";
import { requireAdminPermission } from "auth/permissions";
import { getSession } from "lib/auth/server";
import { redirect } from "next/navigation";

// Force dynamic rendering to avoid static generation issues with session
export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPermission();
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const user = await getUser(id);

  return (
    <UsersTable
      users={user ? [user] : []}
      currentUserId={session.user.id}
      total={user ? 1 : 0}
      page={1}
      limit={1}
      baseUrl="/admin/users"
      sortBy={"createdAt"}
      sortDirection={"desc"}
    />
  );
}
