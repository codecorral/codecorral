import { describe, expect, test, beforeEach } from "bun:test";
import type { Snapshot } from "xstate";
import {
  loadEmbeddedDefinitions,
  getDefinition,
  getMigration,
  getAllDefinitionIds,
  clearDefinitions,
} from "./definition-registry.js";

describe("definition registry", () => {
  beforeEach(() => {
    clearDefinitions();
    loadEmbeddedDefinitions();
  });

  test("registers test-v0.1", () => {
    expect(getDefinition("test-v0.1")).toBeDefined();
  });

  test("registers test-v0.2", () => {
    expect(getDefinition("test-v0.2")).toBeDefined();
  });

  test("both definitions available at startup", () => {
    const ids = getAllDefinitionIds();
    expect(ids).toContain("test-v0.1");
    expect(ids).toContain("test-v0.2");
  });
});

describe("test-v0.1 → test-v0.2 migration", () => {
  beforeEach(() => {
    clearDefinitions();
    loadEmbeddedDefinitions();
  });

  test("migration is registered", () => {
    const migration = getMigration("test-v0.1", "test-v0.2");
    expect(migration).toBeDefined();
  });

  test("maps idle → idle", () => {
    const migration = getMigration("test-v0.1", "test-v0.2")!;
    const snapshot = { value: "idle", context: { submitCount: 0 } } as unknown as Snapshot<unknown>;
    const result = migration(snapshot) as Record<string, unknown>;
    expect(result.value).toBe("idle");
  });

  test("maps working → agent_working", () => {
    const migration = getMigration("test-v0.1", "test-v0.2")!;
    const snapshot = { value: "working", context: { submitCount: 1 } } as unknown as Snapshot<unknown>;
    const result = migration(snapshot) as Record<string, unknown>;
    expect(result.value).toBe("agent_working");
  });

  test("maps reviewing → agent_working", () => {
    const migration = getMigration("test-v0.1", "test-v0.2")!;
    const snapshot = { value: "reviewing", context: { submitCount: 2 } } as unknown as Snapshot<unknown>;
    const result = migration(snapshot) as Record<string, unknown>;
    expect(result.value).toBe("agent_working");
  });

  test("maps done → done", () => {
    const migration = getMigration("test-v0.1", "test-v0.2")!;
    const snapshot = { value: "done", context: {} } as unknown as Snapshot<unknown>;
    const result = migration(snapshot) as Record<string, unknown>;
    expect(result.value).toBe("done");
  });

  test("adds sessionTitle and sessionError to context", () => {
    const migration = getMigration("test-v0.1", "test-v0.2")!;
    const snapshot = {
      value: "idle",
      context: { submitCount: 3, hasWork: true },
    } as unknown as Snapshot<unknown>;
    const result = migration(snapshot) as Record<string, unknown>;
    const ctx = result.context as Record<string, unknown>;
    expect(ctx.sessionTitle).toBeNull();
    expect(ctx.sessionError).toBeNull();
  });

  test("preserves existing context fields", () => {
    const migration = getMigration("test-v0.1", "test-v0.2")!;
    const snapshot = {
      value: "working",
      context: { submitCount: 3, hasWork: true, workStartedAt: "2026-01-01" },
    } as unknown as Snapshot<unknown>;
    const result = migration(snapshot) as Record<string, unknown>;
    const ctx = result.context as Record<string, unknown>;
    expect(ctx.submitCount).toBe(3);
    expect(ctx.hasWork).toBe(true);
    expect(ctx.workStartedAt).toBe("2026-01-01");
  });
});
