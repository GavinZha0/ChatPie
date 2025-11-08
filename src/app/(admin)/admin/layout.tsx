import type { ReactNode } from "react";
import { requireAdminPermission } from "auth/permissions";
import AdminUnauthorized from "./unauthorized";

import { SidebarProvider } from "ui/sidebar";
import { AppSidebar } from "@/components/layouts/app-sidebar";
import { AppToolbar } from "@/components/layouts/app-toolbar";
import { AppHeader } from "@/components/layouts/app-header";
import { cookies } from "next/headers";
import { getSession } from "lib/auth/server";
import { COOKIE_KEY_SIDEBAR_STATE } from "lib/const";
import { AppPopupProvider } from "@/components/layouts/app-popup-provider";
import { UserDetailContent } from "@/components/user/user-detail/user-detail-content";
import { UserDetailContentSkeleton } from "@/components/user/user-detail/user-detail-content-skeleton";
import { Suspense } from "react";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requireAdminPermission();
  } catch (_error) {
    return <AdminUnauthorized />;
  }

  const cookieStore = await cookies();
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const isCollapsed =
    cookieStore.get(COOKIE_KEY_SIDEBAR_STATE)?.value !== "true";
  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppPopupProvider
        userSettingsComponent={
          <Suspense fallback={<UserDetailContentSkeleton />}>
            <UserDetailContent view="user" />
          </Suspense>
        }
      />
      {/* Fixed left toolbar */}
      <AppToolbar user={session.user} />
      <AppSidebar user={session.user} />
      <main className="relative bg-background w-full flex flex-col h-screen md:pl-16">
        <AppHeader />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </SidebarProvider>
  );
}
