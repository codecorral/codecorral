import { Command } from "commander";
import * as fs from "node:fs";
import { loadConfig, getUserConfigPath } from "../../config/loader.js";

export function workspacesCommand(): Command {
  return new Command("workspaces")
    .description("List configured workspaces")
    .action(async () => {
      const configPath = getUserConfigPath();
      if (!fs.existsSync(configPath)) {
        console.log(
          "No configuration found. Create ~/.codecorral/config.yaml or use Nix Home Manager module.",
        );
        return;
      }

      const config = loadConfig();
      const entries = Object.entries(config.workspaces);

      if (entries.length === 0) {
        console.log("No workspaces configured");
        return;
      }

      for (const [name, ws] of entries) {
        const exists = fs.existsSync(ws.path);
        console.log(`${name}:`);
        console.log(`  Path:      ${ws.path} ${exists ? "(exists)" : "(not found)"}`);
        if (ws.workflows?.length) {
          console.log(`  Workflows: ${ws.workflows.join(", ")}`);
        }
        if (ws.agentDeckProfile || ws.agentDeck?.profile) {
          console.log(`  AgentDeck: ${ws.agentDeckProfile ?? ws.agentDeck?.profile}`);
        }
        if (ws.claudeCode?.model) {
          console.log(`  Claude:    ${ws.claudeCode.model}`);
        }
        console.log();
      }
    });
}
