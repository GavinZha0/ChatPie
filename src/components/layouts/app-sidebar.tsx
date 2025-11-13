"use client";
import { useRouter } from "next/navigation";
import { Sidebar, SidebarContent } from "ui/sidebar";
import { AppSidebarAgents } from "./app-sidebar-agents";
import { SidebarHeaderShared } from "./sidebar-header";
import { BasicUser } from "app-types/user";
import { APP_SLOGAN } from "lib/const";

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
      className="border-r border-sidebar-border/80 md:left-16"
    >
      <SidebarHeaderShared
        title={<span className="font-semibold">{APP_SLOGAN}</span>}
        href="/"
        enableShortcuts={true}
        onLinkClick={() => {
          router.push("/");
          router.refresh();
        }}
      />

      <SidebarContent className="overflow-hidden relative">
        <div className="flex flex-col min-h-0">
          <AppSidebarAgents userRole={userRole} />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
