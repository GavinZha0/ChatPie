import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "crypto";

// ============================================
// Constants
// ============================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended 96-bit IV (NIST SP 800-38D)
const TAG_LENGTH = 16; // GCM auth tag 128-bit (maximum security)
const SEPARATOR = ":";
const EXPECTED_PARTS = 3; // iv:authTag:ciphertext

// ============================================
// Key Management
// ============================================

/**
 * Load the master encryption key from environment variable.
 * Validates that it is 64 hex characters (32 bytes = 256 bits).
 */
function getMasterKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be set as a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(keyHex, "hex");
}

// ============================================
// Public API
// ============================================

/**
 * Detect whether a stored value is AES-256-GCM encrypted.
 * Encrypted values have the format: <iv_b64>:<authTag_b64>:<ciphertext_b64>
 * Used during the migration transition to skip already-encrypted values.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(SEPARATOR);
  return parts.length === EXPECTED_PARTS;
}

/**
 * Encrypt a plaintext API key.
 * Produces a self-contained string: <iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * Each call generates a fresh random IV, so identical plaintexts yield
 * different ciphertexts — preventing ciphertext-based deduplication attacks.
 */
export function encryptApiKey(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher: CipherGCM = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

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

/**
 * Decrypt a stored API key value.
 *
 * - If the value looks encrypted (3 colon-separated parts), decrypt it.
 * - If not (legacy plaintext during migration window), return as-is.
 *
 * Throws if the GCM auth tag fails, meaning data has been tampered with.
 */
export function decryptApiKey(stored: string): string {
  if (!isEncrypted(stored)) {
    // Legacy plaintext — return unchanged (migration grace period)
    return stored;
  }

  const key = getMasterKey();
  const parts = stored.split(SEPARATOR);
  const [ivB64, authTagB64, ciphertextB64] = parts;

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher: DecipherGCM = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  // decipher.final() verifies the GCM auth tag — throws on tampering
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
