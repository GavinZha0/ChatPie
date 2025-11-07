import type { ReactNode } from "react";
import { requireAdminPermission } from "auth/permissions";
import AdminUnauthorized from "./unauthorized";

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
  return <>{children}</>;
}
