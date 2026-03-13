import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "ui/card";
import { getTranslations } from "next-intl/server";

interface UsersLayoutProps {
  children: ReactNode;
}

export default async function UsersLayout({ children }: UsersLayoutProps) {
  const t = await getTranslations("Admin.Users");

  return (
    <div className="p-4 w-full">
      <div className="space-y-2 w-full max-w-none">
        {/* Main Card */}
        <Card className="w-full border-none bg-transparent">
          <CardHeader>
            <CardTitle className="text-2xl">{t("allUsers")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-4 w-full">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
