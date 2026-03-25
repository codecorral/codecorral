import { Command } from "commander";
import * as fs from "node:fs";
import { loadConfig, getUserConfigPath } from "../../config/loader.js";

export function projectsCommand(): Command {
  return new Command("projects")
    .description("List configured projects")
    .action(async () => {
      const configPath = getUserConfigPath();
      if (!fs.existsSync(configPath)) {
        console.log(
          "No configuration found. Create ~/.codecorral/config.yaml or use Nix Home Manager module.",
        );
        return;
      }

      const config = loadConfig();
      const entries = Object.entries(config.projects);

      if (entries.length === 0) {
        console.log("No projects configured");
        return;
      }

      for (const [name, proj] of entries) {
        const exists = fs.existsSync(proj.path);
        console.log(`${name}:`);
        console.log(`  Path:      ${proj.path} ${exists ? "(exists)" : "(not found)"}`);
        if (proj.workflows?.length) {
          console.log(`  Workflows: ${proj.workflows.join(", ")}`);
        }
        if (proj.agent_deck_profile) {
          console.log(`  AgentDeck: ${proj.agent_deck_profile}`);
        }
        console.log();
      }
    });
}
