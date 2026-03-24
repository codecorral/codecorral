import { describe, expect, test } from "bun:test";
import {
  extractShortId,
  sanitizeTitle,
  generateSessionTitle,
  getSessionPrefix,
} from "./session-naming.js";

describe("extractShortId", () => {
  test("extracts last 8 chars from standard instance ID", () => {
    expect(extractShortId("test-v0.2-abc12345")).toBe("abc12345");
  });

  test("extracts last 8 chars from definition with hyphens", () => {
    expect(extractShortId("my-workflow-v1-xyz99999")).toBe("xyz99999");
  });

  test("handles short instance ID", () => {
    expect(extractShortId("abcd1234")).toBe("abcd1234");
  });

  test("handles ID shorter than 8 chars", () => {
    expect(extractShortId("abc")).toBe("abc");
  });
});

describe("sanitizeTitle", () => {
  test("lowercases uppercase characters", () => {
    expect(sanitizeTitle("MyPhase")).toBe("myphase");
  });

  test("replaces underscores and dots with hyphens", () => {
    expect(sanitizeTitle("hello_world.test")).toBe("hello-world-test");
  });

  test("collapses consecutive hyphens", () => {
    expect(sanitizeTitle("cc--abc--setup")).toBe("cc-abc-setup");
  });

  test("trims leading and trailing hyphens", () => {
    expect(sanitizeTitle("-hello-")).toBe("hello");
  });

  test("replaces spaces with hyphens", () => {
    expect(sanitizeTitle("my phase")).toBe("my-phase");
  });

  test("handles already-clean input", () => {
    expect(sanitizeTitle("clean-title-123")).toBe("clean-title-123");
  });

  test("handles empty string", () => {
    expect(sanitizeTitle("")).toBe("");
  });

  test("handles all special characters", () => {
    expect(sanitizeTitle("@#$%")).toBe("");
  });
});

describe("generateSessionTitle", () => {
  test("generates cc-{shortId}-{phase} format", () => {
    expect(generateSessionTitle("test-v0.2-abc12345", "setup")).toBe(
      "cc-abc12345-setup",
    );
  });

  test("sanitizes phase name", () => {
    expect(generateSessionTitle("test-v0.2-abc12345", "My_Phase")).toBe(
      "cc-abc12345-my-phase",
    );
  });

  test("generates correct title for longer definition prefix", () => {
    expect(generateSessionTitle("unit-v0.3-xy9z4w2q", "elab")).toBe(
      "cc-xy9z4w2q-elab",
    );
  });

  test("truncates when exceeding 60 chars", () => {
    const longPhase = "a".repeat(50);
    const title = generateSessionTitle("test-v0.2-abc12345", longPhase);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.startsWith("cc-")).toBe(true);
    expect(title.endsWith(`-${longPhase}`)).toBe(true);
  });

  test("stays within 60 char limit", () => {
    const result = generateSessionTitle("test-v0.2-abc12345", "agent");
    expect(result.length).toBeLessThanOrEqual(60);
  });
});

describe("getSessionPrefix", () => {
  test("returns cc-{shortId} format", () => {
    expect(getSessionPrefix("test-v0.2-abc12345")).toBe("cc-abc12345");
  });

  test("prefix matches session titles", () => {
    const prefix = getSessionPrefix("test-v0.2-abc12345");
    expect("cc-abc12345-setup".startsWith(prefix)).toBe(true);
    expect("cc-abc12345-agent".startsWith(prefix)).toBe(true);
    expect("cc-xyz99999-setup".startsWith(prefix)).toBe(false);
  });
});
