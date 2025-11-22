import { notFound, redirect, unauthorized } from "next/navigation";
import { getUserAccounts, getUser } from "lib/user/server";
import { UserDetail } from "@/components/user/user-detail/user-detail";
import {
  UserStatsCardLoader,
  UserStatsCardLoaderSkeleton,
} from "@/components/user/user-detail/user-stats-card-loader";

import { Suspense } from "react";
import { getSession } from "lib/auth/server";
import { requireAdminPermission } from "lib/auth/permissions";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Force dynamic rendering to avoid static generation issues with session
export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  try {
    await requireAdminPermission();
  } catch (_error) {
    unauthorized();
  }
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const [user, userAccountInfo] = await Promise.all([
    getUser(id),
    getUserAccounts(id),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <UserDetail
      user={user}
      currentUserId={session.user.id}
      userAccountInfo={userAccountInfo}
      userStatsSlot={
        <Suspense fallback={<UserStatsCardLoaderSkeleton />}>
          <UserStatsCardLoader userId={id} view="admin" />
        </Suspense>
      }
      view="admin"
    />
  );
}
