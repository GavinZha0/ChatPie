#!/usr/bin/env tsx
import { config } from "dotenv";

// Load environment variables FIRST
const result = config();
if (result.error) {
  console.error("❌ Failed to load .env:", result.error);
} else {
  console.log("✅ .env loaded successfully");
}

import { getPostgresUrl } from "lib/db/pg/db.pg";
import { ProviderTable } from "lib/db/pg/schema.pg";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createCipheriv, randomBytes, CipherGCM } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SEPARATOR = ":";
const EXPECTED_PARTS = 3;

function getMasterKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("ENCRYPTION_KEY string missing or invalid.");
  }
  return Buffer.from(keyHex, "hex");
}

function isEncrypted(value: string): boolean {
  return value.split(SEPARATOR).length === EXPECTED_PARTS;
}

function encryptApiKey(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  }) as CipherGCM;

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(SEPARATOR);
}

const pool = new Pool({
  connectionString: getPostgresUrl(),
});
const db = drizzle(pool);

async function main() {
  console.log("Starting API Key encryption migration...");

  const providers = await db.select().from(ProviderTable);

  let migratedCount = 0;
  let alreadyEncryptedCount = 0;
  let skippedEmptyCount = 0;

  for (const provider of providers) {
    if (!provider.apiKey) {
      skippedEmptyCount++;
      continue;
    }

    if (isEncrypted(provider.apiKey)) {
      alreadyEncryptedCount++;
      continue;
    }

    try {
      const encrypted = encryptApiKey(provider.apiKey);
      await db
        .update(ProviderTable)
        .set({ apiKey: encrypted, updatedAt: new Date() })
        .where(eq(ProviderTable.id, provider.id));

      migratedCount++;
      console.log(`✅ Migrated Provider ID: ${provider.id} (${provider.name})`);
    } catch (err) {
      console.error(
        `❌ Failed to migrate Provider ID: ${provider.id} (${provider.name})`,
      );
      console.error(err);
    }
  }

  console.log("\n--- Migration Summary ---");
  console.log(`Successfully encrypted: ${migratedCount}`);
  console.log(`Already encrypted (skipped): ${alreadyEncryptedCount}`);
  console.log(`Empty keys (skipped): ${skippedEmptyCount}`);
  console.log("Migration complete!");
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("💥 Migration failed with error:");
    console.error(err);
    await pool.end();
    process.exit(1);
  });
