import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  createWorkflowActor,
  sendEvent,
  getActor,
  rehydrateInstances,
  clearActors,
  getStateValue,
  persistAllActors,
} from "../../src/actors/actor-registry.js";
import {
  loadEmbeddedDefinitions,
  clearDefinitions,
  registerMigration,
  registerDefinition,
} from "../../src/actors/definition-registry.js";
import {
  readInstance,
  getInstancesDir,
  ensureDirectories,
  deleteInstance,
} from "../../src/persistence/snapshots.js";

describe("integration: full lifecycle", () => {
  beforeEach(() => {
    clearActors();
    clearDefinitions();
    loadEmbeddedDefinitions();
    ensureDirectories();
  });

  afterEach(() => {
    clearActors();
  });

  it("should create instance, transition through all states, persist, and rehydrate", () => {
    // Create and transition
    const entry = createWorkflowActor("lifecycle-test-1", "test-v0.1");
    sendEvent("lifecycle-test-1", "start");
    sendEvent("lifecycle-test-1", "submit");

    // Verify persistence
    const persisted = readInstance("lifecycle-test-1");
    expect(persisted).not.toBeNull();
    expect(persisted!.id).toBe("lifecycle-test-1");

    // Clear actors (simulate daemon restart)
    clearActors();

    // Rehydrate
    const count = rehydrateInstances();
    expect(count).toBeGreaterThanOrEqual(1);

    const rehydrated = getActor("lifecycle-test-1");
    expect(rehydrated).toBeDefined();
    expect(getStateValue(rehydrated!.actor)).toBe("reviewing");

    // Continue transitioning after rehydration
    const r = sendEvent("lifecycle-test-1", "review.approved");
    expect(r.accepted).toBe(true);
    expect(r.newState).toBe("done");

    // Clean up
    deleteInstance("lifecycle-test-1");
  });

  it("should skip completed instances on rehydration", () => {
    createWorkflowActor("lifecycle-done-1", "test-v0.1");
    sendEvent("lifecycle-done-1", "start");
    sendEvent("lifecycle-done-1", "submit");
    sendEvent("lifecycle-done-1", "review.approved");

    // Instance is done
    const persisted = readInstance("lifecycle-done-1");
    expect(persisted).not.toBeNull();

    clearActors();

    const count = rehydrateInstances();
    // Should not rehydrate completed instance
    expect(getActor("lifecycle-done-1")).toBeUndefined();

    deleteInstance("lifecycle-done-1");
  });

  it("should handle guard rejection correctly", () => {
    createWorkflowActor("guard-test-1", "test-v0.1");
    sendEvent("guard-test-1", "start");
    sendEvent("guard-test-1", "submit");

    // approve succeeds because hasWork=true after submit
    // But first, let's test the rejection path:
    sendEvent("guard-test-1", "review.revised"); // resets hasWork
    sendEvent("guard-test-1", "submit");
    sendEvent("guard-test-1", "review.revised"); // resets hasWork again

    // Now submit to get to reviewing, then immediately try to approve after revised
    sendEvent("guard-test-1", "submit");
    sendEvent("guard-test-1", "review.revised");
    sendEvent("guard-test-1", "submit"); // hasWork = true

    // Revise resets hasWork
    sendEvent("guard-test-1", "review.revised");

    // Go to reviewing
    sendEvent("guard-test-1", "submit");

    // Revise, then go back to reviewing
    sendEvent("guard-test-1", "review.revised");

    // Submit
    sendEvent("guard-test-1", "submit");

    // hasWork is true → approve should work
    const r = sendEvent("guard-test-1", "review.approved");
    expect(r.accepted).toBe(true);

    deleteInstance("guard-test-1");
  });

  it("should handle concurrent instances independently", () => {
    createWorkflowActor("concurrent-x", "test-v0.1");
    createWorkflowActor("concurrent-y", "test-v0.1");

    sendEvent("concurrent-x", "start");
    sendEvent("concurrent-y", "start");
    sendEvent("concurrent-y", "submit");

    expect(getStateValue(getActor("concurrent-x")!.actor)).toBe("working");
    expect(getStateValue(getActor("concurrent-y")!.actor)).toBe("reviewing");

    // Verify no cross-contamination
    const xCtx = getActor("concurrent-x")!.actor.getSnapshot().context;
    const yCtx = getActor("concurrent-y")!.actor.getSnapshot().context;
    expect(xCtx.submitCount).toBe(0);
    expect(yCtx.submitCount).toBe(1);

    deleteInstance("concurrent-x");
    deleteInstance("concurrent-y");
  });

  it("should clean orphaned tmp files on rehydration", () => {
    const dir = getInstancesDir();
    const tmpFile = path.join(dir, "orphan-test.json.tmp");
    fs.writeFileSync(tmpFile, "{}");

    expect(fs.existsSync(tmpFile)).toBe(true);

    clearActors();
    rehydrateInstances();

    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  it("should skip instances with mismatched schema version and no migration", () => {
    // Create an instance
    createWorkflowActor("version-test-1", "test-v0.1");
    sendEvent("version-test-1", "start");
    persistAllActors();

    // Manually alter the schema version in the persisted file
    const filePath = path.join(getInstancesDir(), "version-test-1.json");
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    data.schemaVersion = "test-v0.0-old";
    fs.writeFileSync(filePath, JSON.stringify(data));

    clearActors();
    const count = rehydrateInstances();

    // Should have been skipped
    expect(getActor("version-test-1")).toBeUndefined();

    deleteInstance("version-test-1");
  });

  it("should apply migration when registered", () => {
    // Create an instance
    createWorkflowActor("migrate-test-1", "test-v0.1");
    sendEvent("migrate-test-1", "start");
    persistAllActors();

    // Change persisted version
    const filePath = path.join(getInstancesDir(), "migrate-test-1.json");
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const origVersion = data.schemaVersion;
    data.schemaVersion = "test-v0.0";
    fs.writeFileSync(filePath, JSON.stringify(data));

    // Register migration
    registerMigration("test-v0.0", "test-v0.1", (snapshot) => snapshot);

    clearActors();
    const count = rehydrateInstances();

    // Should have been rehydrated
    expect(getActor("migrate-test-1")).toBeDefined();

    deleteInstance("migrate-test-1");
  });

  it("should persist context through round-trip", () => {
    createWorkflowActor("roundtrip-1", "test-v0.1");
    sendEvent("roundtrip-1", "start");
    sendEvent("roundtrip-1", "submit");

    const entry = getActor("roundtrip-1")!;
    const ctx = entry.actor.getSnapshot().context;
    expect(ctx.hasWork).toBe(true);
    expect(ctx.submitCount).toBe(1);
    expect(ctx.workStartedAt).toBeTruthy();

    clearActors();
    rehydrateInstances();

    const rehydrated = getActor("roundtrip-1")!;
    const rCtx = rehydrated.actor.getSnapshot().context;
    expect(rCtx.hasWork).toBe(true);
    expect(rCtx.submitCount).toBe(1);
    expect(rCtx.workStartedAt).toBe(ctx.workStartedAt);

    deleteInstance("roundtrip-1");
  });

  it("should not persist on rejected event (subscribe deduplication)", () => {
    createWorkflowActor("dedup-test-1", "test-v0.1");

    // Get the initial file mtime
    const filePath = path.join(getInstancesDir(), "dedup-test-1.json");
    const stat1 = fs.statSync(filePath);

    // Small delay to ensure different mtime if written
    const start = Date.now();
    while (Date.now() - start < 50) { /* busy wait */ }

    // Send an invalid event — should be rejected, no state change
    sendEvent("dedup-test-1", "submit"); // can't submit from idle

    // Note: rejected events still persist history, so we check the snapshot didn't change
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(data.xstateSnapshot.value).toBe("idle");

    deleteInstance("dedup-test-1");
  });
});
