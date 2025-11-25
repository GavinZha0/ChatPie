"use client";

import { useState, useRef } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "ui/avatar";
import { Camera, Loader2, Upload, Smile, ImageIcon } from "lucide-react";
import { useFileUpload } from "@/hooks/use-presigned-upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "ui/popover";
import { Button } from "ui/button";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";

import { EmojiAvatarDialog } from "./emoji-avatar-dialog";
import { DefaultAvatarDialog } from "./default-avatar-dialog";

interface UserAvatarUploadProps {
  currentImageUrl?: string | null;
  userName: string;
  onImageUpdate: (imageUrl: string) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function UserAvatarUpload({
  currentImageUrl,
  userName,
  onImageUpdate,
  disabled = false,
}: UserAvatarUploadProps) {
  const t = useTranslations("User.Profile.common");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showDefaultDialog, setShowDefaultDialog] = useState(false);
  const [showEmojiDialog, setShowEmojiDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading, isStorageReady } = useFileUpload();

  const isTriggerDisabled = disabled || isUploading;
  const isUploadOptionDisabled = isTriggerDisabled || !isStorageReady;

  const displayUrl = previewUrl || currentImageUrl;

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t("pleaseUploadValidImage"));
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t("imageSizeMustBeLessThan"));
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    const result = await upload(file);
    if (result) {
      onImageUpdate(result.url);
      toast.success(t("profilePhotoUpdatedSuccessfully"));
    } else {
      // Reset preview on failure
      setPreviewUrl(null);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    if (isUploadOptionDisabled) {
      return;
    }
    setIsOpen(false);
    fileInputRef.current?.click();
  };

  const handleDefaultAvatarClick = () => {
    if (isTriggerDisabled) {
      return;
    }
    setIsOpen(false);
    setShowDefaultDialog(true);
  };

  const handleEmojiClick = () => {
    if (isTriggerDisabled) {
      return;
    }
    setIsOpen(false);
    setShowEmojiDialog(true);
  };

  return (
    <div className="relative inline-block">
      <div className="relative">
        <Avatar className="size-26 rounded-full ring ring-border">
          <AvatarImage src={displayUrl || undefined} />
          <AvatarFallback className="text-lg font-semibold">
            {userName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Upload Progress Overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
            <Loader2 className="size-8 animate-spin text-white" />
          </div>
        )}

        {/* Edit Button - Bottom Right */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className={cn(
                "absolute bottom-0 right-0 size-8 rounded-full shadow-lg",
                isTriggerDisabled && "cursor-not-allowed opacity-60",
              )}
              disabled={isTriggerDisabled}
            >
              <Camera className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <div className="flex flex-col gap-1">
              <Tooltip disableHoverableContent={isStorageReady}>
                <TooltipTrigger asChild>
                  <span className="w-full">
                    <Button
                      variant="ghost"
                      className="justify-start w-full"
                      onClick={handleUploadClick}
                      disabled={isUploadOptionDisabled}
                    >
                      <Upload className="mr-2 size-4" />
                      {t("uploadPhoto")}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isStorageReady && (
                  <TooltipContent className="max-w-xs text-left">
                    <p>{t("fileStorageNotAvailable")}</p>
                  </TooltipContent>
                )}
              </Tooltip>

              <Button
                variant="ghost"
                className="justify-start w-full"
                onClick={handleDefaultAvatarClick}
                disabled={isTriggerDisabled}
              >
                <ImageIcon className="mr-2 size-4" />
                {t("chooseDefault")}
              </Button>

              <Button
                variant="ghost"
                className="justify-start w-full"
                onClick={handleEmojiClick}
                disabled={isTriggerDisabled}
              >
                <Smile className="mr-2 size-4" />
                {t("useEmoji")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploadOptionDisabled}
      />

      {/* Dialogs */}
      <DefaultAvatarDialog
        open={showDefaultDialog}
        onOpenChange={setShowDefaultDialog}
        onSelect={onImageUpdate}
      />

      <EmojiAvatarDialog
        open={showEmojiDialog}
        onOpenChange={setShowEmojiDialog}
        onSelect={onImageUpdate}
      />
    </div>
  );
}
