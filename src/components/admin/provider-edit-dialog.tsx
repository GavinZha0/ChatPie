"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { Input } from "ui/input";
import { Label } from "ui/label";
import { Button } from "ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  updateProviderApiKeyAction,
  saveProviderAction,
} from "@/app/api/provider/actions";
import { useRouter } from "next/navigation";

interface ProviderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: {
    id: number;
    name: string;
    alias: string;
    baseUrl: string;
    apiKey: string | null;
  } | null;
  onSuccess?: () => void;
}

export function ProviderEditDialog({
  open,
  onOpenChange,
  provider,
  onSuccess,
}: ProviderEditDialogProps) {
  const t = useTranslations("Admin.Providers");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [alias, setAlias] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (open && provider) {
      setAlias(provider.alias);
      setBaseUrl(provider.baseUrl);
      setApiKey(provider.apiKey || "");
    }
  }, [open, provider]);

  const handleSubmit = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    try {
      if (baseUrl !== provider.baseUrl) {
        // Update baseUrl and apiKey together using saveProviderAction
        await saveProviderAction({
          id: provider.id,
          name: provider.name,
          alias: provider.alias,
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim() || null,
        });
      } else {
        // Only update apiKey
        await updateProviderApiKeyAction(provider.id, apiKey.trim() || null);
      }

      toast.success(t("toast.updateSuccess"));
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch (error) {
      toast.error(t("toast.updateFailed"));
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [provider, baseUrl, apiKey, onOpenChange, onSuccess, router]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !loading) {
      // Reset form when closing
      if (provider) {
        setBaseUrl(provider.baseUrl);
        setApiKey(provider.apiKey || "");
      }
    }
    onOpenChange(newOpen);
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{provider.name}</DialogTitle>
          <DialogDescription>{t("form.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="provider-alias">{t("form.fields.alias")}</Label>
            <Input
              id="provider-alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={t("form.placeholders.alias")}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="provider-base-url">
              {t("form.fields.baseUrl")}
            </Label>
            <Input
              id="provider-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t("form.placeholders.baseUrl")}
              className="bg-input border-transparent font-mono"
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="provider-api-key">{t("form.fields.apiKey")}</Label>
            <Input
              id="provider-api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("form.placeholders.apiKey")}
              className="bg-input border-transparent font-mono"
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={loading}>
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tCommon("saving")}
              </>
            ) : (
              tCommon("save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
