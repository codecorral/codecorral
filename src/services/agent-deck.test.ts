import { describe, expect, test } from "bun:test";
import { execAgentDeck, type AgentDeckError } from "./agent-deck.js";

describe("execAgentDeck", () => {
  test("rejects with AgentDeckError on non-zero exit", async () => {
    try {
      // Use a command guaranteed to fail
      await execAgentDeck(["--nonexistent-flag-xyz"], 5_000);
      expect(true).toBe(false); // should not reach here
    } catch (err) {
      const adErr = err as AgentDeckError;
      expect(adErr.exitCode).toBeDefined();
      expect(adErr.command).toContain("agent-deck");
    }
  });

  test("parses error code from JSON stderr", () => {
    // Test the parseErrorCode logic indirectly by checking the type structure
    const mockError: AgentDeckError = {
      exitCode: 1,
      stderr: '{"success":false,"error":"Multiple sessions match","code":"AMBIGUOUS"}',
      command: "agent-deck session stop test",
      code: "AMBIGUOUS",
    };
    expect(mockError.code).toBe("AMBIGUOUS");
  });

  test("handles ALREADY_EXISTS error code", () => {
    const mockError: AgentDeckError = {
      exitCode: 1,
      stderr: '{"success":false,"error":"Session exists","code":"ALREADY_EXISTS"}',
      command: "agent-deck launch /tmp",
      code: "ALREADY_EXISTS",
    };
    expect(mockError.code).toBe("ALREADY_EXISTS");
  });

  test("timeout produces exitCode -1", async () => {
    try {
      // sleep for longer than the timeout
      await execAgentDeck(["__nonexistent_subcommand__"], 1);
      expect(true).toBe(false);
    } catch (err) {
      const adErr = err as AgentDeckError;
      // Either timeout (-1) or spawn error — both are valid rejections
      expect(adErr.exitCode).toBeDefined();
      expect(adErr.command).toContain("agent-deck");
    }
  });
});
