"use client";
import { useRouter } from "next/navigation";
import { Sidebar, SidebarContent, SidebarFooter } from "ui/sidebar";
import { AppSidebarMenus } from "./app-sidebar-menus";
import { AppSidebarAgents } from "./app-sidebar-agents";
import { SidebarHeaderShared } from "./sidebar-header";

import { AppSidebarUser } from "./app-sidebar-user";
import { BasicUser } from "app-types/user";
import { APP_NAME } from "lib/const";

export function AppSidebar({
  user,
}: {
  user?: BasicUser;
}) {
  const userRole = user?.role;
  const router = useRouter();

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r border-sidebar-border/80"
    >
      <SidebarHeaderShared
        title={
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo"
              width={32}
              height={32}
              className="object-contain"
            />
            <span>{APP_NAME}</span>
          </div>
        }
        href="/"
        enableShortcuts={true}
        onLinkClick={() => {
          router.push("/");
          router.refresh();
        }}
      />

      <SidebarContent className="mt-2 overflow-hidden relative">
        <div className="flex flex-col overflow-y-auto">
          <AppSidebarMenus user={user} />
          <AppSidebarAgents userRole={userRole} />
        </div>
      </SidebarContent>
      <SidebarFooter className="flex flex-col items-stretch space-y-2">
        <AppSidebarUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
