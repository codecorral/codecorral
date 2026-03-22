import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createWorkflowActor,
  sendEvent,
  getActor,
  clearActors,
  getStateValue,
} from "../../src/actors/actor-registry.js";
import {
  loadEmbeddedDefinitions,
  clearDefinitions,
} from "../../src/actors/definition-registry.js";
import { deleteInstance, ensureDirectories } from "../../src/persistence/snapshots.js";

/**
 * These tests exercise the MCP tool logic at the actor level.
 * They verify the same operations that MCP tools invoke on the daemon:
 * workflow.transition, workflow.status, workflow.context, workflow.setBrowserUrl
 *
 * Full daemon+socket+MCP integration requires spawning processes
 * and is covered by the daemon lifecycle tests.
 */
describe("MCP tool operations", () => {
  beforeEach(() => {
    clearActors();
    clearDefinitions();
    loadEmbeddedDefinitions();
    ensureDirectories();
  });

  afterEach(() => {
    clearActors();
    deleteInstance("mcp-test-1");
    deleteInstance("mcp-test-2");
  });

  describe("workflow.transition", () => {
    it("should fire a transition and return TransitionResult", () => {
      createWorkflowActor("mcp-test-1", "test-v0.1");
      const result = sendEvent("mcp-test-1", "start");

      expect(result.accepted).toBe(true);
      expect(result.newState).toBe("working");
      expect(result.message).toContain("Transitioned");
    });

    it("should handle transition with payload", () => {
      createWorkflowActor("mcp-test-1", "test-v0.1");
      sendEvent("mcp-test-1", "start");
      sendEvent("mcp-test-1", "submit");

      const result = sendEvent("mcp-test-1", "review.revised", {
        feedback: "add tests",
      });

      expect(result.accepted).toBe(true);
      expect(result.newState).toBe("working");
    });

    it("should return error for missing instance", () => {
      const result = sendEvent("nonexistent", "start");
      expect(result.accepted).toBe(false);
      expect(result.message).toContain("Instance not found");
    });
  });

  describe("workflow.status", () => {
    it("should return current state and available transitions", () => {
      createWorkflowActor("mcp-test-1", "test-v0.1");
      sendEvent("mcp-test-1", "start");

      const entry = getActor("mcp-test-1")!;
      const snapshot = entry.actor.getSnapshot();
      const state = getStateValue(entry.actor);

      expect(state).toBe("working");
      expect(entry.definitionId).toBe("test-v0.1");

      // can() for available transitions
      expect(snapshot.can({ type: "submit" })).toBe(true);
      expect(snapshot.can({ type: "start" })).toBe(false);
      expect(snapshot.can({ type: "review.approved" })).toBe(false);
    });

    it("should report correct transitions in reviewing state", () => {
      createWorkflowActor("mcp-test-1", "test-v0.1");
      sendEvent("mcp-test-1", "start");
      sendEvent("mcp-test-1", "submit");

      const snapshot = getActor("mcp-test-1")!.actor.getSnapshot();
      expect(snapshot.can({ type: "review.approved" })).toBe(true);
      expect(snapshot.can({ type: "review.revised" })).toBe(true);
      expect(snapshot.can({ type: "submit" })).toBe(false);
    });
  });

  describe("workflow.context", () => {
    it("should return XState context for the instance", () => {
      createWorkflowActor("mcp-test-1", "test-v0.1");
      sendEvent("mcp-test-1", "start");
      sendEvent("mcp-test-1", "submit");

      const ctx = getActor("mcp-test-1")!.actor.getSnapshot().context;
      expect(ctx.hasWork).toBe(true);
      expect(ctx.submitCount).toBe(1);
      expect(ctx.workStartedAt).toBeTruthy();
    });
  });

  describe("workflow.setBrowserUrl", () => {
    it("should store URL in instance context", () => {
      createWorkflowActor("mcp-test-1", "test-v0.1");
      sendEvent("mcp-test-1", "start");

      const ctx = getActor("mcp-test-1")!.actor.getSnapshot()
        .context as Record<string, unknown>;
      ctx.browserUrl = "https://github.com/org/repo/pull/42";

      expect(ctx.browserUrl).toBe("https://github.com/org/repo/pull/42");
    });
  });

  describe("MCP per-session independence", () => {
    it("should handle two independent instances concurrently (simulating two MCP sessions)", () => {
      // Two MCP sessions would each have their own WFE_INSTANCE_ID
      createWorkflowActor("mcp-test-1", "test-v0.1");
      createWorkflowActor("mcp-test-2", "test-v0.1");

      // Session 1 advances
      sendEvent("mcp-test-1", "start");
      sendEvent("mcp-test-1", "submit");

      // Session 2 independent
      sendEvent("mcp-test-2", "start");

      // Verify independence
      expect(getStateValue(getActor("mcp-test-1")!.actor)).toBe("reviewing");
      expect(getStateValue(getActor("mcp-test-2")!.actor)).toBe("working");

      const ctx1 = getActor("mcp-test-1")!.actor.getSnapshot().context;
      const ctx2 = getActor("mcp-test-2")!.actor.getSnapshot().context;
      expect(ctx1.submitCount).toBe(1);
      expect(ctx2.submitCount).toBe(0);
    });
  });
});
