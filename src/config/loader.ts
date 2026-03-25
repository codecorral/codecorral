import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { parse as parseYaml } from "yaml";
import type { CodeCorralConfig, ProjectConfig } from "../actors/types.js";

const USER_CONFIG_PATH = path.join(os.homedir(), ".codecorral", "config.yaml");

export function loadConfig(projectDir?: string): CodeCorralConfig {
  const userConfig = loadConfigFile(USER_CONFIG_PATH);

  if (projectDir) {
    const projectConfigPath = path.join(projectDir, ".codecorral", "config.yaml");
    const projectConfig = loadConfigFile(projectConfigPath);
    return mergeConfigs(userConfig, projectConfig);
  }

  return userConfig;
}

function loadConfigFile(filePath: string): CodeCorralConfig {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = parseYaml(content) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") {
      return { projects: {} };
    }
    const projects = (parsed.projects ?? {}) as Record<string, ProjectConfig>;
    return { projects };
  } catch {
    return { projects: {} };
  }
}

function mergeConfigs(
  userConfig: CodeCorralConfig,
  projectConfig: CodeCorralConfig,
): CodeCorralConfig {
  const merged: CodeCorralConfig = { projects: { ...userConfig.projects } };

  for (const [name, projectProj] of Object.entries(projectConfig.projects)) {
    if (merged.projects[name]) {
      merged.projects[name] = {
        ...merged.projects[name],
        ...projectProj,
      };
    } else {
      merged.projects[name] = projectProj;
    }
  }

  return merged;
}

export function getUserConfigPath(): string {
  return USER_CONFIG_PATH;
}
