import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "ui/card";

export default async function AdminUnauthorized() {
  const t = await getTranslations("Common");

  return (
    <div className="flex min-h-full w-full items-center justify-center px-6 py-12">
      <Card className="w-full max-w-xl border border-muted/40 bg-background/70">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              {t("unauthorized")}
            </h2>
            <p className="text-base text-muted-foreground">
              {t("adminAuthorized")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
