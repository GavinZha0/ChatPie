"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MCPIcon } from "ui/mcp-icon";
import { Waypoints, FolderSearchIcon, Users, Boxes } from "lucide-react";
import { cn } from "lib/utils";
import { useTranslations } from "next-intl";
import { Avatar, AvatarImage, AvatarFallback } from "ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { UserMenuList } from "./app-sidebar-user";
import { BasicUser } from "app-types/user";
import { getIsUserAdmin, getUserAvatar } from "lib/user/utils";
import { resetChatState } from "@/app/store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const ITEM_CLASS =
  "flex flex-col items-center justify-center gap-2 px-2 py-2 text-xs hover:bg-accent hover:text-accent-foreground rounded-md transition-colors";

function ToolbarItem({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  isActive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={cn(ITEM_CLASS)}
          data-testid={`toolbar-link-${label.toLowerCase()}`}
          aria-label={label}
        >
          <div
            className={cn(
              "flex items-center justify-center rounded-md size-10",
              isActive &&
                "bg-primary text-primary-foreground ring-1 ring-primary",
            )}
          >
            <Icon className="size-6" />
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function AppToolbar({ user }: { user?: BasicUser }) {
  const pathname = usePathname();
  const t = useTranslations("");
  const isAdmin = getIsUserAdmin(user);
  const router = useRouter();

  return (
    <aside
      className="fixed left-0 top-0 z-30 h-svh w-16 border-r bg-sidebar hidden md:flex flex-col items-center justify-between py-3"
      style={{
        // Expose width to other components (sidebar offset)
        ["--app-toolbar-w" as any]: "4rem",
      }}
      data-testid="app-toolbar"
    >
      <div className="flex flex-col items-stretch gap-1">
        {/* Logo moved from sidebar header */}
        <Link
          href="/"
          aria-label="Home"
          className="flex items-center justify-center py-2"
          onClick={(e) => {
            e.preventDefault();

            // Dismiss any existing toasts
            toast.dismiss();

            // Reset all chat state (messages, agents, files, panels)
            resetChatState();

            // Navigate to home and refresh to ensure component remount
            router.push("/");
            router.refresh();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo"
            width={36}
            height={36}
            className="object-contain"
          />
        </Link>
        <ToolbarItem
          href="/mcp"
          icon={MCPIcon as any}
          label={t("Layout.mcpConfiguration") || "MCP"}
          isActive={pathname.startsWith("/mcp")}
        />
        <ToolbarItem
          href="/workflow"
          icon={Waypoints}
          label={t("Layout.workflow") || "Workflow"}
          isActive={pathname.startsWith("/workflow")}
        />
        <ToolbarItem
          href="/archive"
          icon={FolderSearchIcon}
          label={t("Archive.title") || "Archive"}
          isActive={pathname.startsWith("/archive")}
        />
        {isAdmin && (
          <ToolbarItem
            href="/admin/providers"
            icon={Boxes}
            label={t("Layout.providers") || "Providers"}
            isActive={pathname.startsWith("/admin/providers")}
          />
        )}
        {isAdmin && (
          <ToolbarItem
            href="/admin/users"
            icon={Users}
            label={t("Admin.Users.title") || "Users"}
            isActive={pathname.startsWith("/admin/users")}
          />
        )}
      </div>
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex flex-col items-center gap-1 px-2 py-2 rounded-md hover:bg-accent"
              data-testid="toolbar-user-button"
            >
              <Avatar className="size-10 border">
                <AvatarImage
                  src={getUserAvatar(user)}
                  alt={user.name || "User"}
                />
                <AvatarFallback>{user.name?.slice(0, 1) || ""}</AvatarFallback>
              </Avatar>
              <span
                className="text-[10px] max-w-14 truncate"
                title={user.email || undefined}
              >
                {user.name}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="p-0">
            <div className="w-64">
              <UserMenuList user={user} />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </aside>
  );
}

export default AppToolbar;
