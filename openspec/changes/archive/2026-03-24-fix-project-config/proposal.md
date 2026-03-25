## Why

The engine-core change shipped workspace configuration and a Home Manager module, but the HM module doesn't function correctly: it generates JSON instead of YAML, the Nix package build has a placeholder hash that won't build, and the delegation to upstream modules is incomplete. Additionally, "workspace" collides with cmux's use of the term for vertical tabs — this will cause confusion when the view-engine unit lands.

The HM module should be a composition layer that fans out project declarations to upstream modules. Per-project claude-code configuration (agents, rules, skills, settings) should pass through fully to agentplot-kit's `programs.claude-code.profiles.<name>`. Per-project agent-deck is limited to the `claude.config_dir` convention (nix-agent-deck profiles only accept `configDir`). Global agent-deck settings (conductor, MCPs, shell, docker) are the user's responsibility via `programs.agent-deck` directly. Conductor/session layout will be handled by the `configure-agent-deck-session` intent via shuffle. OpenSpec schemas are collected as a union across all projects.

## What Changes

- **BREAKING**: Rename "workspace" → "project" across all types, config keys, CLI commands, specs, HM module options, and documentation (snake_case per Nix convention)
- Redesign HM module as a per-project composition layer:
  - **Per-project** `programs.codecorral.projects.<name>.claude_code` → full pass-through to `programs.claude_code.profiles.<name>.*` (via agentplot-kit)
  - **Per-project** agent-deck profile creation: auto-set `claude.config_dir = ".claude-<project_name>"` convention
  - **Cross-project** openspec schemas union → `programs.openspec.schemas`
- Slim `config.yaml` to engine-own state only (path, workflows, profile reference)
- Fix HM module YAML output (replace `builtins.toJSON`)
- Fix `codecorral` Nix package build
- Explicitly depend on agentplot-kit for claude-code profiles (not upstream HM module)
- Document `homeManagerModules.codecorral` in README

## Capabilities

### New Capabilities

_None — this is a fix-up of existing capabilities._

### Modified Capabilities

- `workspace-config`: Rename to `project-config` — slim to engine-own state; tool config delegated to upstream modules
- `cli`: `codecorral workspaces` → `codecorral projects`; daemon RPC handler renamed
- `nix-distribution`: Redesign HM module with two-level delegation, fix YAML output, fix package build, require agentplot-kit

## Impact

- **Config format**: `workspaces:` → `projects:` (snake_case), tool-specific fields removed — **BREAKING**
- **TypeScript types**: `WorkspaceConfig` → `ProjectConfig` (slimmed), `CodeCorralConfig.workspaces` → `CodeCorralConfig.projects`
- **CLI**: `codecorral workspaces` → `codecorral projects`; daemon RPC handler `"workspaces"` → `"projects"`
- **Nix**: `programs.codecorral.workspaces` → `programs.codecorral.projects` with `claude_code` pass-through, agentplot-kit required
- **Tests**: Config loader, CLI integration, daemon RPC tests updated
- **README**: New section with full project declaration examples
