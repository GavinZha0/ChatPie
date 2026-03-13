import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  FileMetadata,
  FileStorage,
  UploadOptions,
  UploadUrl,
  UploadUrlOptions,
} from "./file-storage.interface";
import {
  resolveStoragePrefix,
  sanitizeFilename,
  toBuffer,
} from "./storage-utils";
import { FileNotFoundError } from "lib/errors";

const STORAGE_PREFIX = resolveStoragePrefix();

const required = (name: string, value: string | undefined) => {
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
};

const getFileTypeFolder = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  switch (ext) {
    // Images
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "bmp":
    case "svg":
    case "webp":
      return "image";

    // Web files
    case "html":
    case "htm":
    case "css":
    case "scss":
    case "less":
      return "web";

    // Data files
    case "csv":
    case "json":
    case "xml":
    case "yaml":
    case "yml":
      return "data";

    // Text files
    case "txt":
    case "md":
    case "log":
      return "text";

    // Code files
    case "py":
    case "js":
    case "ts":
    case "jsx":
    case "tsx":
    case "java":
    case "c":
    case "cpp":
    case "cs":
    case "go":
    case "rs":
    case "php":
    case "rb":
    case "swift":
    case "kt":
      return "code";

    // Default
    default:
      return "others";
  }
};

const buildKey = (filename: string) => {
  const safeName = sanitizeFilename(filename || "file");
  const now = new Date();

  // Format: 20260312T182436374Z (YYYYMMDDTHHMMSSmmmZ)
  const dateStr = now.toISOString().replace(/[-:.]/g, "");

  // Use date as folder name (20260312)
  const dateFolder = dateStr.substring(0, 8);

  // Use time with milliseconds as prefix (182436374Z)
  const timePrefix = dateStr.substring(9);

  // Get file type folder based on extension
  const typeFolder = getFileTypeFolder(safeName);

  const prefix = STORAGE_PREFIX ? `${STORAGE_PREFIX}/` : "";

  return path.posix.join(
    prefix,
    typeFolder,
    dateFolder,
    `${timePrefix}-${safeName}`,
  );
};

const buildPublicUrl = (
  bucket: string,
  region: string,
  key: string,
  publicBaseUrl?: string,
  endpoint?: string,
  forcePathStyle?: boolean,
) => {
  if (publicBaseUrl) {
    const baseUrl = publicBaseUrl.replace(/\/$/, "");
    // Check if bucket is already included in publicBaseUrl
    if (baseUrl.endsWith(`/${bucket}`)) {
      // base url with bucket: http://localhost:9000/chatpie
      return `${baseUrl}/${encodeURI(key)}`;
    } else {
      // base url without bucket: http://localhost:9000
      return `${baseUrl}/${bucket}/${encodeURI(key)}`;
    }
  }

  // If custom endpoint provided (e.g., MinIO), fall back to constructing from it
  if (endpoint) {
    const base = endpoint.replace(/\/$/, "");
    if (forcePathStyle) return `${base}/${bucket}/${encodeURI(key)}`;
    try {
      const u = new URL(base);
      return `${u.protocol}//${bucket}.${u.host}/${encodeURI(key)}`;
    } catch {
      return `${base}/${bucket}/${encodeURI(key)}`;
    }
  }

  // AWS standard virtual-hostedâ€“style URL
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURI(key)}`;
};

export const createS3FileStorage = (): FileStorage => {
  const bucket = required(
    "FILE_STORAGE_S3_BUCKET",
    process.env.FILE_STORAGE_S3_BUCKET,
  );
  const region = process.env.FILE_STORAGE_S3_REGION || process.env.AWS_REGION;
  if (!region)
    throw new Error(
      "Missing required env: FILE_STORAGE_S3_REGION or AWS_REGION",
    );
  const endpoint = process.env.FILE_STORAGE_S3_ENDPOINT;
  const forcePathStyle = /^1|true$/i.test(
    process.env.FILE_STORAGE_S3_FORCE_PATH_STYLE || "",
  );
  const publicBaseUrl = process.env.FILE_STORAGE_S3_PUBLIC_BASE_URL;

  // Primary S3Client for server-side operations (upload, download, etc.)
  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    // Use RustFS credentials when using RustFS endpoint
    credentials:
      endpoint && endpoint.includes("rustfs")
        ? {
            accessKeyId:
              process.env.RUSTFS_ACCESS_KEY ||
              process.env.AWS_ACCESS_KEY_ID ||
              "",
            secretAccessKey:
              process.env.RUSTFS_SECRET_KEY ||
              process.env.AWS_SECRET_ACCESS_KEY ||
              "",
          }
        : undefined,
  });

  // Create a separate S3Client for presigned URLs if publicBaseUrl is available
  // This allows frontend to use external address while server uses internal address
  const getPresignedS3Client = () => {
    if (publicBaseUrl) {
      // Extract the base endpoint from publicBaseUrl for presigned URLs
      try {
        const url = new URL(publicBaseUrl);
        // url.host includes both hostname and port (e.g., "localhost:9000")
        // url.hostname would be just "localhost", url.port would be "9000"
        const publicEndpoint = `${url.protocol}//${url.host}`;
        return new S3Client({
          region,
          endpoint: publicEndpoint,
          forcePathStyle,
          // Use RustFS credentials for presigned URLs as well
          credentials:
            endpoint && endpoint.includes("rustfs")
              ? {
                  accessKeyId:
                    process.env.RUSTFS_ACCESS_KEY ||
                    process.env.AWS_ACCESS_KEY_ID ||
                    "",
                  secretAccessKey:
                    process.env.RUSTFS_SECRET_KEY ||
                    process.env.AWS_SECRET_ACCESS_KEY ||
                    "",
                }
              : undefined,
        });
      } catch {
        // Fallback to primary S3Client if publicBaseUrl is invalid
        return s3;
      }
    }
    return s3;
  };

  return {
    async upload(content, options: UploadOptions = {}) {
      const buffer = await toBuffer(content);
      const filename = options.filename ?? "file";
      const key = buildKey(filename);

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: options.contentType,
          ACL: undefined, // rely on bucket policy for public/private
        }),
      );

      const metadata: FileMetadata = {
        key,
        filename: path.posix.basename(key),
        contentType: options.contentType || "application/octet-stream",
        size: buffer.byteLength,
        uploadedAt: new Date(),
      };

      const sourceUrl = buildPublicUrl(
        bucket,
        region,
        key,
        publicBaseUrl,
        endpoint,
        forcePathStyle,
      );

      return { key, sourceUrl, metadata };
    },

    async createUploadUrl(
      options: UploadUrlOptions,
    ): Promise<UploadUrl | null> {
      const key = buildKey(options.filename);
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: options.contentType,
      });
      const expires = Math.max(
        60,
        Math.min(60 * 60 * 12, options.expiresInSeconds ?? 900),
      );

      // Use the presigned S3Client for frontend-accessible URLs
      const presignedS3 = getPresignedS3Client();
      const url = await getSignedUrl(presignedS3, command, {
        expiresIn: expires,
      });

      return {
        key,
        url,
        method: "PUT",
        expiresAt: new Date(Date.now() + expires * 1000),
        headers: { "Content-Type": options.contentType },
      };
    },

    async download(key) {
      try {
        const res = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        const body = res.Body;
        if (!body) throw new FileNotFoundError(key);
        const stream = body as unknown as NodeJS.ReadableStream;
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          stream.on("data", (c) =>
            chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
          );
          stream.once("end", () => resolve());
          stream.once("error", (e) => reject(e));
        });
        return Buffer.concat(chunks);
      } catch (error: unknown) {
        if ((error as any)?.$metadata?.httpStatusCode === 404) {
          throw new FileNotFoundError(key, error);
        }
        throw error;
      }
    },

    async delete(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    async exists(key) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (error: unknown) {
        if ((error as any)?.$metadata?.httpStatusCode === 404) return false;
        return false;
      }
    },

    async getMetadata(key) {
      try {
        const res = await s3.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        return {
          key,
          filename: path.posix.basename(key),
          contentType: res.ContentType || "application/octet-stream",
          size: Number(res.ContentLength || 0),
          uploadedAt: res.LastModified ?? undefined,
        } satisfies FileMetadata;
      } catch (error: unknown) {
        if ((error as any)?.$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },

    async getSourceUrl(key) {
      return buildPublicUrl(
        bucket,
        region,
        key,
        publicBaseUrl,
        endpoint,
        forcePathStyle,
      );
    },

    async getDownloadUrl(key) {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
      return url;
    },
  } satisfies FileStorage;
};
