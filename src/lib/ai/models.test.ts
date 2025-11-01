import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock server-only to allow testing
vi.mock("server-only", () => ({}));

// Mock database repository
vi.mock("lib/db/repository", () => ({
  providerRepository: {
    selectAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("logger", () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

let modelsModule: typeof import("./models");

beforeAll(async () => {
  modelsModule = await import("./models");
});

describe("customModelProvider", () => {
  it("should be defined", () => {
    const { customModelProvider } = modelsModule;
    expect(customModelProvider).toBeDefined();
    expect(customModelProvider.getModelsInfo).toBeDefined();
    expect(customModelProvider.getModel).toBeDefined();
    expect(customModelProvider.isToolCallSupported).toBeDefined();
  });
});
