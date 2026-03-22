#!/usr/bin/env node

import { Command } from "commander";
import { statusCommand } from "./commands/status.js";
import { historyCommand } from "./commands/history.js";
import { transitionCommand } from "./commands/transition.js";
import { workspacesCommand } from "./commands/workspaces.js";
import { daemonCommand } from "./commands/daemon.js";
import { gcCommand } from "./commands/gc.js";

const program = new Command();

program
  .name("codecorral")
  .description("CodeCorral workflow engine — orchestration layer for AI-DLC")
  .version("0.1.0");

program.addCommand(statusCommand());
program.addCommand(historyCommand());
program.addCommand(transitionCommand());
program.addCommand(workspacesCommand());
program.addCommand(daemonCommand());
program.addCommand(gcCommand());

program.parse();
