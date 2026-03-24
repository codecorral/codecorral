## 1. Rename workspace → project in TypeScript

- [ ] 1.1 Rename `WorkspaceConfig` → `ProjectConfig` in `src/actors/types.ts` — slim down to engine-own fields: `path`, `workflows`, `agent_deck_profile` (string reference), `openspec_schemas_path`. Remove `agentDeck`, `claudeCode`, `openspec` nested objects (those belong to upstream modules now)
- [ ] 1.2 Rename `CodeCorralConfig.workspaces` → `CodeCorralConfig.projects` in `src/actors/types.ts`
- [ ] 1.3 Update `src/config/loader.ts`: change YAML key from `workspaces` to `projects`, rename variables, update `mergeConfigs`
- [ ] 1.4 Rename `src/cli/commands/workspaces.ts` → `src/cli/commands/projects.ts`, update command name to `projects`, update output to reflect slimmed config (path, workflows, profile reference)
- [ ] 1.5 Update `src/cli/index.ts`: import from `projects.js`, register `projectsCommand()`
- [ ] 1.6 Update `src/daemon/server.ts`: rename any workspace references to project
- [ ] 1.7 Update test files: `test/config/loader.test.ts` and `test/integration/daemon-cli.test.ts` — change workspace references to project, update YAML fixtures to use `projects:` key with slimmed fields

## 2. Redesign Home Manager module as pass-through composition layer

- [ ] 2.1 Rename `workspaceType` → `projectType` and `programs.codecorral.workspaces` → `programs.codecorral.projects` in `nix/codecorral-hm-module.nix`
- [ ] 2.2 Replace typed `agentDeck`, `claudeCode`, `openspec` submodule options with pass-through sections: `agent_deck = lib.mkOption { type = lib.types.attrsOf lib.types.anything; default = {}; }` (and same for `claude_code`, `openspec`)
- [ ] 2.3 Implement delegation logic: merge `project.agent_deck` into `programs.agent-deck.profiles.<project_name>` with auto-set `claude.config_dir = ".claude-${project_name}"` (using `lib.mkDefault` so user can override)
- [ ] 2.4 Implement delegation logic: merge `project.claude_code` into `programs.claude-code.profiles.<project_name>` with auto-set `config_dir = ".claude-${project_name}"` (using `lib.mkDefault`)
- [ ] 2.5 Implement delegation logic: collect union of all `project.openspec.schemas` and set `programs.openspec.schemas`
- [ ] 2.6 Generate `config.yaml` with engine-own state only: `path`, `workflows`, `agent_deck_profile = <project_name>` (the reference), `openspec.schemas_path` if set
- [ ] 2.7 Replace `builtins.toJSON` with `pkgs.formats.yaml {}` for proper YAML output
- [ ] 2.8 Update assertion message text from "workspaces" to "projects"
- [ ] 2.9 Guard upstream delegation with `lib.mkIf` checks for module availability (skip without error if upstream not imported)

## 3. Fix Nix package build

- [ ] 3.1 Fix `packages.codecorral` in `flake.nix`: replace empty `npmDepsHash` with proper hash, switch build to Bun-based, update wrapper script
- [ ] 3.2 Verify `nix build .#codecorral` completes without errors
- [ ] 3.3 Update `checks` in `flake.nix` if needed for renamed module

## 4. Update specs and documentation

- [ ] 4.1 Rename `openspec/specs/workspace-config/` directory to `openspec/specs/project-config/`
- [ ] 4.2 Update workspace → project terminology in main spec files
- [ ] 4.3 Add "Project Configuration via Home Manager" section to README.md with full pass-through examples showing agent_deck (conductor, telegram, MCPs), claude_code (agents, rules, skills), and openspec delegation
- [ ] 4.4 Update CLAUDE.md project structure and any workspace references to use project terminology
- [ ] 4.5 Update README.md "Workspace = workflow instance" → "Project = workflow instance"

## 5. Verification

- [ ] 5.1 Run `bun test` — all tests pass with renamed types and slimmed config
- [ ] 5.2 Run `bun run typecheck` — no type errors
- [ ] 5.3 Run `nix flake check` — flake validation passes
- [ ] 5.4 Verify HM module parses as valid Nix: `nix-instantiate --parse nix/codecorral-hm-module.nix`
