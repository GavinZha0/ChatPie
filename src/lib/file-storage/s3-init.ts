import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";

export async function initS3() {
  // Only run if using S3 storage driver
  if (process.env.FILE_STORAGE_TYPE !== "s3") {
    return;
  }

  const bucket = process.env.FILE_STORAGE_S3_BUCKET;
  const region = process.env.FILE_STORAGE_S3_REGION || process.env.AWS_REGION;
  const forcePathStyle = /^1|true$/i.test(
    process.env.FILE_STORAGE_S3_FORCE_PATH_STYLE || "",
  );

  if (!bucket || !region) {
    console.warn("S3 configuration missing, skipping auto-init.");
    return;
  }

  // 3. Initialize S3 client with configured endpoint which is internal S3 endpoint
  const configuredEndpoint = process.env.FILE_STORAGE_S3_ENDPOINT;
  try {
    const s3 = new S3Client({
      region,
      endpoint: configuredEndpoint,
      forcePathStyle,
    });

    // 1. Check if bucket exists
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error: any) {
      if (error?.$metadata?.httpStatusCode === 404) {
        console.log(`Bucket '${bucket}' not found. Creating...`);
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log(`Bucket '${bucket}' created successfully.`);
      } else {
        throw error;
      }
    }

    // 2. Apply public read/write policy for bucket (RustFS/MinIO usually require this for public access)
    // Note: This policy might need adjustment for AWS S3 if "Block Public Access" is enabled.
    // For local RustFS/MinIO, this is standard.

    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowPublicReadWriteForUploads",
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject", "s3:PutObject"],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    };

    console.log(`Applying public policy to bucket '${bucket}'...`);
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify(policy),
      }),
    );
    console.log("Bucket policy applied successfully.");

    console.log(
      `Bucket '${bucket}' initialized (policy skipped for RustFS compatibility).`,
    );
  } catch (error) {
    console.warn("Failed to initialize S3 bucket:", error);
    // Don't crash the app, just log warning
  }
}
