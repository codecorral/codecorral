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
    expect(config.projects).toEqual({});
  });

  it("should parse valid config file with snake_case keys", () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configPath,
      `projects:
  my-project:
    path: /tmp/my-project
    workflows:
      - intent
      - unit
    agent_deck_profile: my-project
`,
    );

    const config = loadConfig();
    expect(config.projects["my-project"]).toBeDefined();
    expect(config.projects["my-project"].path).toBe("/tmp/my-project");
    expect(config.projects["my-project"].workflows).toEqual(["intent", "unit"]);
    expect(config.projects["my-project"].agent_deck_profile).toBe("my-project");
  });

  it("should handle malformed config gracefully", () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, "not: valid: yaml: [[[");

    const config = loadConfig();
    expect(config.projects).toBeDefined();
  });

  it("should return correct config path", () => {
    expect(getUserConfigPath()).toBe(configPath);
  });

  it("should merge user and project configs", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codecorral-test-"));
    const projectConfigDir = path.join(tmpDir, ".codecorral");
    fs.mkdirSync(projectConfigDir, { recursive: true });

    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configPath,
      `projects:
  my-project:
    path: /tmp/my-project
    agent_deck_profile: my-project
`,
    );

    fs.writeFileSync(
      path.join(projectConfigDir, "config.yaml"),
      `projects:
  my-project:
    path: /tmp/my-project
    workflows:
      - intent
      - unit
`,
    );

    const config = loadConfig(tmpDir);
    expect(config.projects["my-project"].workflows).toEqual(["intent", "unit"]);
    expect(config.projects["my-project"].agent_deck_profile).toBe("my-project");

    fs.rmSync(tmpDir, { recursive: true });
  });
});
