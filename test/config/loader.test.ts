import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadConfig, getUserConfigPath } from "../../src/config/loader.js";

describe("config loader", () => {
  const configDir = path.join(os.homedir(), ".codecorral");
  const configPath = path.join(configDir, "config.yaml");
  let originalContent: string | null = null;

  beforeEach(() => {
    try {
      originalContent = fs.readFileSync(configPath, "utf-8");
    } catch {
      originalContent = null;
    }
  });

  afterEach(() => {
    if (originalContent !== null) {
      fs.writeFileSync(configPath, originalContent);
    } else {
      try { fs.unlinkSync(configPath); } catch { /* ignore */ }
    }
  });

  it("should return empty config when file does not exist", () => {
    try { fs.unlinkSync(configPath); } catch { /* ignore */ }
    const config = loadConfig();
    expect(config.workspaces).toEqual({});
  });

  it("should parse valid config file", () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configPath,
      `workspaces:
  my-project:
    path: /tmp/my-project
    workflows:
      - intent
      - unit
    agentDeckProfile: my-project
`,
    );

    const config = loadConfig();
    expect(config.workspaces["my-project"]).toBeDefined();
    expect(config.workspaces["my-project"].path).toBe("/tmp/my-project");
    expect(config.workspaces["my-project"].workflows).toEqual(["intent", "unit"]);
  });

  it("should handle malformed config gracefully", () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, "not: valid: yaml: [[[");

    // Should not throw
    const config = loadConfig();
    expect(config.workspaces).toBeDefined();
  });

  it("should return correct config path", () => {
    expect(getUserConfigPath()).toBe(configPath);
  });
});
