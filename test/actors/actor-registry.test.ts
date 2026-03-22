import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  createWorkflowActor,
  sendEvent,
  getActor,
  getAllActors,
  generateInstanceId,
  rehydrateInstances,
  clearActors,
  getStateValue,
} from "../../src/actors/actor-registry.js";
import {
  loadEmbeddedDefinitions,
  clearDefinitions,
  registerMigration,
} from "../../src/actors/definition-registry.js";
import { getInstancesDir, ensureDirectories } from "../../src/persistence/snapshots.js";

const TEST_DIR = path.join(os.homedir(), ".codecorral-test");
const ORIG_HOME = process.env.HOME;

describe("actor-registry", () => {
  beforeEach(() => {
    // Use a test directory to avoid polluting real data
    clearActors();
    clearDefinitions();
    loadEmbeddedDefinitions();
  });

  afterEach(() => {
    clearActors();
  });

  it("should generate instance IDs in the correct format", () => {
    const id = generateInstanceId("test-v0.1");
    expect(id).toMatch(/^test-v0\.1-[a-z0-9]{8}$/);
  });

  it("should create a workflow actor from definition", () => {
    const entry = createWorkflowActor("test-instance-1", "test-v0.1");
    expect(entry.instanceId).toBe("test-instance-1");
    expect(entry.definitionId).toBe("test-v0.1");
    expect(getStateValue(entry.actor)).toBe("idle");
  });

  it("should throw for unknown definition", () => {
    expect(() => createWorkflowActor("bad-1", "nonexistent")).toThrow(
      "Definition not found: nonexistent",
    );
  });

  it("should send events and track transitions", () => {
    createWorkflowActor("test-send-1", "test-v0.1");

    const r1 = sendEvent("test-send-1", "start");
    expect(r1.accepted).toBe(true);
    expect(r1.newState).toBe("working");

    const r2 = sendEvent("test-send-1", "submit");
    expect(r2.accepted).toBe(true);
    expect(r2.newState).toBe("reviewing");

    // Guard: hasWork is true after submit, approve should work
    const r3 = sendEvent("test-send-1", "review.approved");
    expect(r3.accepted).toBe(true);
    expect(r3.newState).toBe("done");
  });

  it("should reject invalid events", () => {
    createWorkflowActor("test-reject-1", "test-v0.1");

    const r = sendEvent("test-reject-1", "submit"); // Can't submit from idle
    expect(r.accepted).toBe(false);
    expect(r.newState).toBeNull();
  });

  it("should reject review.approved when hasWork is false", () => {
    createWorkflowActor("test-guard-1", "test-v0.1");

    sendEvent("test-guard-1", "start");
    sendEvent("test-guard-1", "submit");
    sendEvent("test-guard-1", "review.revised"); // resets hasWork
    sendEvent("test-guard-1", "submit"); // back to reviewing, hasWork=true
    sendEvent("test-guard-1", "review.revised"); // resets hasWork again

    // Now in working, submit to get to reviewing with hasWork=true
    sendEvent("test-guard-1", "submit");

    // Revise again to set hasWork=false
    sendEvent("test-guard-1", "review.revised");

    // Submit to reviewing
    sendEvent("test-guard-1", "submit");
    // hasWork=true, revise to make it false
    sendEvent("test-guard-1", "review.revised");
    sendEvent("test-guard-1", "submit");
    sendEvent("test-guard-1", "review.revised");
    sendEvent("test-guard-1", "submit");

    // Now approve — hasWork should be true after submit
    const entry = getActor("test-guard-1");
    expect(entry!.actor.getSnapshot().context.hasWork).toBe(true);

    const r = sendEvent("test-guard-1", "review.approved");
    expect(r.accepted).toBe(true);
  });

  it("should track event history", () => {
    createWorkflowActor("test-history-1", "test-v0.1");

    sendEvent("test-history-1", "start");
    sendEvent("test-history-1", "submit");
    sendEvent("test-history-1", "nonexistent-event");

    const entry = getActor("test-history-1")!;
    expect(entry.history.length).toBe(3);
    expect(entry.history[0].event).toBe("start");
    expect(entry.history[0].accepted).toBe(true);
    expect(entry.history[2].event).toBe("nonexistent-event");
    expect(entry.history[2].accepted).toBe(false);
  });

  it("should return error for events on non-existent instances", () => {
    const r = sendEvent("nonexistent", "start");
    expect(r.accepted).toBe(false);
    expect(r.message).toContain("Instance not found");
  });

  it("should handle concurrent instances independently", () => {
    createWorkflowActor("concurrent-a", "test-v0.1");
    createWorkflowActor("concurrent-b", "test-v0.1");

    sendEvent("concurrent-a", "start");
    expect(getStateValue(getActor("concurrent-a")!.actor)).toBe("working");
    expect(getStateValue(getActor("concurrent-b")!.actor)).toBe("idle");

    sendEvent("concurrent-b", "start");
    sendEvent("concurrent-b", "submit");
    expect(getStateValue(getActor("concurrent-a")!.actor)).toBe("working");
    expect(getStateValue(getActor("concurrent-b")!.actor)).toBe("reviewing");
  });
});
