import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  persistInstance,
  readInstance,
  readAllInstances,
  deleteInstance,
  getInstancesDir,
  ensureDirectories,
} from "../../src/persistence/snapshots.js";
import type { PersistedWorkflowInstance } from "../../src/actors/types.js";

describe("snapshot persistence", () => {
  const testInstance: PersistedWorkflowInstance = {
    id: "test-persist-1",
    definitionId: "test-v0.1",
    schemaVersion: "test-v0.1",
    xstateSnapshot: { value: "idle", status: "active" } as unknown as import("xstate").Snapshot<unknown>,
    history: [],
    timestamps: {
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  };

  beforeEach(() => {
    ensureDirectories();
  });

  afterEach(() => {
    // Clean up test instances
    try {
      deleteInstance("test-persist-1");
      deleteInstance("test-persist-2");
    } catch { /* ignore */ }
  });

  it("should persist and read an instance", () => {
    persistInstance(testInstance);
    const read = readInstance("test-persist-1");
    expect(read).not.toBeNull();
    expect(read!.id).toBe("test-persist-1");
    expect(read!.definitionId).toBe("test-v0.1");
    expect(read!.schemaVersion).toBe("test-v0.1");
  });

  it("should use atomic write (tmp + rename)", () => {
    const dir = getInstancesDir();
    persistInstance(testInstance);

    // After persist, there should be no .tmp file
    const tmpFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".tmp"));
    expect(tmpFiles.length).toBe(0);

    // The .json file should exist
    const jsonFile = path.join(dir, "test-persist-1.json");
    expect(fs.existsSync(jsonFile)).toBe(true);
  });

  it("should return null for non-existent instance", () => {
    const read = readInstance("nonexistent-id");
    expect(read).toBeNull();
  });

  it("should list all instances", () => {
    persistInstance(testInstance);
    persistInstance({
      ...testInstance,
      id: "test-persist-2",
    });

    const all = readAllInstances();
    const ids = all.map((i) => i.id);
    expect(ids).toContain("test-persist-1");
    expect(ids).toContain("test-persist-2");
  });

  it("should delete an instance", () => {
    persistInstance(testInstance);
    expect(readInstance("test-persist-1")).not.toBeNull();

    const deleted = deleteInstance("test-persist-1");
    expect(deleted).toBe(true);
    expect(readInstance("test-persist-1")).toBeNull();
  });
});
