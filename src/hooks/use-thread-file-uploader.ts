"use client";

import { useCallback } from "react";
import { appStore, UploadedFile } from "@/app/store";
import { useFileUpload } from "@/hooks/use-presigned-upload";
import { generateUUID } from "@/lib/utils";
import { toast } from "sonner";

// detect if the URL points to a local file server
export const isLocalFileServer = (url: string): boolean => {
  if (!url) return true; // conservative approach for empty URLs

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // detect common local addresses and development tools
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.endsWith(".local") ||
      hostname.includes("ngrok") ||
      hostname.includes("tunnel") ||
      hostname.includes("localtunnel")
    ) {
      return true;
    }

    // properly detect 172.16.0.0-172.31.255.255 private IP range
    if (hostname.startsWith("172.")) {
      const parts = hostname.split(".");
      if (parts.length >= 2) {
        const secondOctet = parseInt(parts[1], 10);
        return secondOctet >= 16 && secondOctet <= 31;
      }
    }

    return false;
  } catch {
    return true; // use base64 for invalid URLs as a conservative approach
  }
};

// convert image file to base64 DataURL
const convertFileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

export function useThreadFileUploader(threadId?: string) {
  const appStoreMutate = appStore((s) => s.mutate);
  const { upload } = useFileUpload();

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!threadId || files.length === 0) return;
      const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB per file

      for (const file of files) {
        if (file.size > MAX_SIZE_BYTES) {
          toast.error(`${file.name}: file too large (>50MB)`);
          continue;
        }

        const previewUrl = file.type?.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined;
        const fileId = generateUUID();
        const abortController = new AbortController();

        // 对于图片文件，预先生成base64 DataURL
        let dataUrl: string | undefined;
        if (file.type?.startsWith("image/")) {
          try {
            dataUrl = await convertFileToDataUrl(file);
          } catch (error) {
            console.warn(`Failed to convert ${file.name} to base64:`, error);
          }
        }

        const uploadingFile: UploadedFile = {
          id: fileId,
          url: "",
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          isUploading: true,
          progress: 0,
          previewUrl,
          abortController,
          dataUrl, // 添加base64 DataURL
        };

        appStoreMutate((prev) => ({
          threadFiles: {
            ...prev.threadFiles,
            [threadId]: [...(prev.threadFiles[threadId] ?? []), uploadingFile],
          },
        }));

        try {
          const uploaded = await upload(file);
          if (uploaded) {
            // 智能检测：如果是本地文件服务器且有dataUrl，优先使用dataUrl
            const shouldUseDataUrl = isLocalFileServer(uploaded.url) && dataUrl;

            appStoreMutate((prev) => ({
              threadFiles: {
                ...prev.threadFiles,
                [threadId]: (prev.threadFiles[threadId] ?? []).map((f) =>
                  f.id === fileId
                    ? {
                        ...f,
                        url: uploaded.url,
                        dataUrl: shouldUseDataUrl ? dataUrl : f.dataUrl,
                        isUploading: false,
                        progress: 100,
                      }
                    : f,
                ),
              },
            }));
          } else {
            appStoreMutate((prev) => ({
              threadFiles: {
                ...prev.threadFiles,
                [threadId]: (prev.threadFiles[threadId] ?? []).filter(
                  (f) => f.id !== fileId,
                ),
              },
            }));
          }
        } catch (_err) {
          appStoreMutate((prev) => ({
            threadFiles: {
              ...prev.threadFiles,
              [threadId]: (prev.threadFiles[threadId] ?? []).filter(
                (f) => f.id !== fileId,
              ),
            },
          }));
        } finally {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
        }
      }
    },
    [threadId, appStoreMutate, upload],
  );

  return { uploadFiles };
}
