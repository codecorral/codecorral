## 1. Rename workspace → project in TypeScript

- [x] 1.1 In `src/actors/types.ts`: rename `WorkspaceConfig` → `ProjectConfig`, slim to engine-own fields (`path`, `workflows`, `agent_deck_profile` (string), `openspec_schemas_path` (optional string)). Remove nested `agentDeck`, `claudeCode`, `openspec` objects. Rename `CodeCorralConfig.workspaces` → `CodeCorralConfig.projects`.
- [x] 1.2 In `src/config/loader.ts`: change YAML key from `workspaces` to `projects`, rename all variables, update `mergeConfigs` to use `projects`. Ensure snake_case keys are parsed (`agent_deck_profile`, `schemas_path`).
- [x] 1.3 Rename `src/cli/commands/workspaces.ts` → `src/cli/commands/projects.ts`. Update command name to `projects`. Remove `claudeCode.model` and `agentDeck` detail display lines — CLI now shows only: project name, path (with existence check), workflows, agent-deck profile name reference.
- [x] 1.4 In `src/cli/index.ts`: import from `projects.js`, register `projectsCommand()`.
- [x] 1.5 In `src/daemon/server.ts`: rename RPC handler from `connection.onRequest("workspaces", ...)` → `connection.onRequest("projects", ...)`. Update returned object keys from `{ workspaces: ... }` → `{ projects: ... }`.
- [x] 1.6 Check `src/daemon/client.ts` (if it exists) for hardcoded `"workspaces"` RPC calls and rename to `"projects"`.
- [x] 1.7 Update test files `test/config/loader.test.ts` and `test/integration/daemon-cli.test.ts`: change all workspace references to project, update YAML fixtures to use `projects:` key with snake_case fields (`agent_deck_profile`, `schemas_path`). Add test for slimmed config merging (user-level `agent_deck_profile` + project-level `workflows` override).

## 2. Redesign Home Manager module

- [x] 2.1 Rename `workspaceType` → `projectType` and `programs.codecorral.workspaces` → `programs.codecorral.projects`. Use snake_case option names throughout.
- [x] 2.2 Replace the entire typed `workspaceType` submodule (current lines 6-69) with new `projectType`: `path` (string), `workflows` (list of strings), `claude_code` (`attrsOf anything`, default `{}`), `openspec` (typed submodule with `schemas` list and `schemas_path` nullable string). Remove `agentDeck`, `claudeCode` typed submodules.
- [x] 2.3 Implement per-project agent-deck profile: for each project, set `programs.agent-deck.profiles.${name}.claude.config_dir = lib.mkDefault ".claude-${name}"`. Guard with `lib.mkIf (lib.hasAttrByPath ["programs" "agent-deck"] config)`.
- [x] 2.4 Implement per-project claude-code delegation using `lib.mkMerge`:
  ```nix
  programs.claude-code.profiles.${name} = lib.mkMerge [
    { config_dir = lib.mkDefault ".claude-${name}"; }
    proj.claude_code
  ];
  ```
  Guard with `lib.mkIf (lib.hasAttrByPath ["programs" "claude-code" "profiles"] config)` — skip with warning if agentplot-kit profiles not available.
- [x] 2.5 Implement openspec delegation: collect union of all `project.openspec.schemas` and set `programs.openspec.schemas`. Guard with `lib.hasAttrByPath`.
- [x] 2.6 Generate `config.yaml` with engine-own state only: for each project, write `path`, `workflows`, `agent_deck_profile = <project_name>`, and `openspec.schemas_path` (if set). No tool-specific config in the YAML.
- [x] 2.7 Replace `builtins.toJSON` with YAML generation. Try `lib.generators.toYAML {}` first (pure Nix, no build dependency). Fall back to `pkgs.formats.yaml {}` if needed (note: pulls in Python/remarshal closure).
- [x] 2.8 Update duplicate profile assertion message from "workspaces" to "projects".
- [x] 2.9 Guard all upstream delegation with `lib.hasAttrByPath` checks (skip without error if upstream not imported).

## 3. Fix Nix package build

- [x] 3.1 Fix `packages.codecorral` in `flake.nix`: try `bun2nix` (`mkBunDerivation`) first, fall back to `pkgs.stdenv.mkDerivation` with `pkgs.bun` in `nativeBuildInputs`. Replace empty `npmDepsHash` and `npx tsc`. Document Bun-in-Nix caveats (sandbox compile bug bun#24645, AVX/macOS). Fall back to Node.js build if Bun sandbox issues arise.
- [x] 3.2 Verify `nix build .#codecorral` completes without errors.
- [x] 3.3 Update `checks` in `flake.nix` for renamed module.

## 4. Update specs and documentation

- [x] 4.1 Rename `openspec/specs/workspace-config/` directory to `openspec/specs/project-config/` and update spec content.
- [x] 4.2 Update workspace → project terminology in `openspec/specs/cli/spec.md` and `openspec/specs/nix-distribution/spec.md`. Do NOT rename "workspace" in `openspec/explorations/workflow-engine/domain-model.md` (those refer to cmux workspaces).
- [x] 4.3 Add "Project Configuration via Home Manager" section to README.md: required flake inputs (codecorral, agentplot-kit, nix-agent-deck), `disabledModules` for upstream claude-code, full project declaration example (claude-code agents/rules/skills, openspec schemas), two conventions (profile name, shared config_dir) and how to override, note that config.yaml is engine-own state only, note that global agent-deck config is set directly via `programs.agent-deck`.
- [x] 4.4 Update README.md "Workspace = workflow instance" → "Project = workflow instance" and other workspace references.
- [x] 4.5 Update CLAUDE.md if any workspace references exist (project structure section).
- [x] 4.6 Add agentplot-kit as documented dependency in README installation section.

## 5. Verification

- [x] 5.1 Run `bun run typecheck` — no type errors (run BEFORE tests to catch type issues first).
- [x] 5.2 Clean `dist/` folder to avoid stale type declarations, then run `bun test` — all tests pass.
- [x] 5.3 Run `nix flake check` — flake validation passes.
- [x] 5.4 Verify HM module parses as valid Nix: `nix-instantiate --parse nix/codecorral-hm-module.nix`.
- [x] 5.5 Verify HM module doesn't error when upstream modules are not imported (test graceful skip).
