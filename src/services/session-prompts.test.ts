import { describe, expect, test } from "bun:test";
import { renderPreamble, assembleSessionPrompt } from "./session-prompts.js";

describe("renderPreamble", () => {
  test("includes instance ID export instruction", () => {
    const result = renderPreamble("test-v0.2-abc12345", []);
    expect(result).toContain("test-v0.2-abc12345");
    expect(result).toContain('export WFE_INSTANCE_ID="test-v0.2-abc12345"');
  });

  test("lists workflow tools", () => {
    const result = renderPreamble("test-v0.2-abc12345", [
      "workflow.transition",
      "workflow.status",
    ]);
    expect(result).toContain("workflow.transition");
    expect(result).toContain("workflow.status");
  });

  test("includes tool descriptions", () => {
    const result = renderPreamble("test-v0.2-abc12345", [
      "workflow.transition",
    ]);
    expect(result).toContain("Fire a workflow transition event");
  });

  test("handles empty tools list", () => {
    const result = renderPreamble("test-v0.2-abc12345", []);
    expect(result).toContain("test-v0.2-abc12345");
    expect(result).toContain("Available workflow tools:");
  });
});

describe("assembleSessionPrompt", () => {
  const tools = ["workflow.transition", "workflow.status", "workflow.context"];

  test("prepends preamble to phase prompt", () => {
    const result = assembleSessionPrompt(
      "test-v0.2-abc12345",
      "Do the thing.",
      tools,
    );
    expect(result).toContain('export WFE_INSTANCE_ID="test-v0.2-abc12345"');
    expect(result).toContain("Do the thing.");
    // Preamble comes first
    const preambleIdx = result.indexOf("WFE_INSTANCE_ID");
    const promptIdx = result.indexOf("Do the thing.");
    expect(preambleIdx).toBeLessThan(promptIdx);
  });

  test("empty phase prompt yields preamble only", () => {
    const result = assembleSessionPrompt("test-v0.2-abc12345", "", tools);
    expect(result).toContain("WFE_INSTANCE_ID");
    expect(result).not.toContain("\n\n\n"); // no double blank line
  });

  test("phase prompt appended as-is", () => {
    const phasePrompt = "Line 1\nLine 2\n  indented";
    const result = assembleSessionPrompt(
      "test-v0.2-abc12345",
      phasePrompt,
      tools,
    );
    expect(result).toContain(phasePrompt);
  });
});
