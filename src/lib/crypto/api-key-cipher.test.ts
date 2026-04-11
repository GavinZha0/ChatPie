import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================
// Mock environment — must be set before importing the module
// ============================================

const TEST_KEY = "a".repeat(64); // 64 hex chars = 32 bytes

beforeEach(() => {
  vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
});

vi.mock("server-only", () => ({}));

// Dynamic import so the env stub is in place first
const { encryptApiKey, decryptApiKey, isEncrypted } = await import(
  "./api-key-cipher"
);

// ============================================
// isEncrypted
// ============================================

describe("isEncrypted", () => {
  it("returns false for plain text API keys", () => {
    expect(isEncrypted("sk-1234567890abcdef")).toBe(false);
    expect(isEncrypted("my-plain-api-key")).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });

  it("returns true for encrypted values (3-part colon-separated)", () => {
    const encrypted = encryptApiKey("sk-test");
    expect(encrypted.split(":")).toHaveLength(3);
    expect(isEncrypted(encrypted)).toBe(true);
  });
});

// ============================================
// encryptApiKey
// ============================================

describe("encryptApiKey", () => {
  it("produces a ciphertext different from the plaintext", () => {
    const plaintext = "sk-OPENAI-SUPER-SECRET-KEY-12345";
    const ciphertext = encryptApiKey(plaintext);
    expect(ciphertext).not.toBe(plaintext);
  });

  it("produces a colon-separated 3-part string (iv:authTag:ciphertext)", () => {
    const result = encryptApiKey("test-key");
    const parts = result.split(":");
    expect(parts).toHaveLength(3);
    // Each part should be valid base64
    parts.forEach((part) => {
      expect(() => Buffer.from(part, "base64")).not.toThrow();
      expect(part.length).toBeGreaterThan(0);
    });
  });

  it("generates a different ciphertext on every call (random IV)", () => {
    const plaintext = "same-key-every-time";
    const cipher1 = encryptApiKey(plaintext);
    const cipher2 = encryptApiKey(plaintext);
    expect(cipher1).not.toBe(cipher2);
  });

  it("can encrypt empty string", () => {
    const result = encryptApiKey("");
    expect(isEncrypted(result)).toBe(true);
  });

  it("can encrypt unicode / special character keys", () => {
    const plain = "key-with-special-chars: 你好 ñoño €£¥";
    const encrypted = encryptApiKey(plain);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decryptApiKey(encrypted)).toBe(plain);
  });
});

// ============================================
// decryptApiKey
// ============================================

describe("decryptApiKey", () => {
  it("round-trips correctly (encrypt → decrypt == original)", () => {
    const original = "sk-proj-ABCDEFGHIJ1234567890";
    const ciphertext = encryptApiKey(original);
    expect(decryptApiKey(ciphertext)).toBe(original);
  });

  it("handles legacy plaintext keys without error (migration grace period)", () => {
    const plain = "sk-legacy-plain-key";
    expect(decryptApiKey(plain)).toBe(plain);
  });

  it("handles empty string plaintext", () => {
    const encrypted = encryptApiKey("");
    expect(decryptApiKey(encrypted)).toBe("");
  });

  it("throws when the ciphertext has been tampered with", () => {
    const encrypted = encryptApiKey("legit-key");
    // Corrupt the ciphertext portion (3rd part)
    const parts = encrypted.split(":");
    const tampered = parts[0] + ":" + parts[1] + ":AAAAAAAAAAAAAAAA";
    expect(() => decryptApiKey(tampered)).toThrow();
  });

  it("throws when the auth tag has been tampered with", () => {
    const encrypted = encryptApiKey("legit-key");
    const parts = encrypted.split(":");
    const tampered = parts[0] + ":AAAAAAAAAAAAAAAAAAAAAA==" + ":" + parts[2];
    expect(() => decryptApiKey(tampered)).toThrow();
  });
});

// ============================================
// getMasterKey validation
// ============================================

describe("ENCRYPTION_KEY validation", () => {
  it("throws when ENCRYPTION_KEY is missing", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    expect(() => encryptApiKey("any")).toThrow("ENCRYPTION_KEY");
  });

  it("throws when ENCRYPTION_KEY is too short", () => {
    vi.stubEnv("ENCRYPTION_KEY", "abc123");
    expect(() => encryptApiKey("any")).toThrow("ENCRYPTION_KEY");
  });
});
