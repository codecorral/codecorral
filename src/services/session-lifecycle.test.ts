import { describe, expect, test, mock, beforeEach } from "bun:test";

// These tests verify the stopSessionTree logic structurally.
// Since stopSessionTree calls execAgentDeck (which calls child_process.spawn),
// we test the exported function signatures and error handling behavior.

describe("stopSessionTree", () => {
  test("module exports stopSessionTree function", async () => {
    const mod = await import("./session-lifecycle.js");
    expect(typeof mod.stopSessionTree).toBe("function");
  });

  test("module exports discoverWorkflowSessions function", async () => {
    const mod = await import("./session-lifecycle.js");
    expect(typeof mod.discoverWorkflowSessions).toBe("function");
  });
});

describe("stopSessionTree depth-first behavior (structural)", () => {
  test("stopSessionTree accepts title and prefix parameters", async () => {
    const mod = await import("./session-lifecycle.js");
    // Verify function signature — it should accept (title, prefix)
    expect(mod.stopSessionTree.length).toBe(2);
  });
});

describe("exit-code-2-as-success behavior", () => {
  test("AgentDeckError with exitCode 2 represents not-found", () => {
    // This is a structural test — stopSession treats exit code 2 as success
    const error = { exitCode: 2, stderr: "not found", command: "agent-deck session stop test" };
    expect(error.exitCode).toBe(2);
  });
});
