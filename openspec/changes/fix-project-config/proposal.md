## Why

The engine-core change shipped workspace configuration and a Home Manager module, but the HM module doesn't function correctly: it generates JSON instead of YAML, the Nix package build has a placeholder hash that won't build, and the delegation to upstream modules is incomplete — it only passes a thin slice of options when it should be a full pass-through composition layer. Users should be able to declare all agent-deck settings (conductor, telegram, MCPs, docker, etc.) and all claude-code settings (agents, rules, skills, etc.) from within a project declaration. Additionally, "workspace" collides with cmux's use of the term for vertical tabs — this will cause confusion when the view-engine unit lands.

## What Changes

- **BREAKING**: Rename "workspace" → "project" across all types, config keys, CLI commands, specs, HM module options, and documentation (using snake_case per Nix convention)
- Redesign HM module as a full pass-through composition layer: `project.agent_deck.*` → `programs.agent_deck.profiles.<name>.*`, `project.claude_code.*` → `programs.claude_code.profiles.<name>.*`, `project.openspec.schemas` → `programs.openspec.schemas`
- Establish two conventions: profile name = project name, shared `config_dir = ".claude-${project_name}"` (auto-set unless overridden)
- Slim down `config.yaml` to engine-own state only (path, workflows, profile reference) — tool config belongs to upstream modules
- Fix HM module to generate proper YAML instead of JSON
- Fix the `codecorral` Nix package build (proper hash, Bun-based build)
- Add README documentation for `homeManagerModules.codecorral` with full project declaration examples

## Capabilities

### New Capabilities

_None — this is a fix-up of existing capabilities._

### Modified Capabilities

- `workspace-config`: Rename to `project-config` — slim down to engine-own state; tool-specific config removed from config.yaml (delegated to upstream modules)
- `cli`: The `codecorral workspaces` command becomes `codecorral projects`
- `nix-distribution`: Redesign HM module as full pass-through composition layer, fix YAML output, fix package build

## Impact

- **Config format**: `workspaces:` key in `config.yaml` becomes `projects:`, tool-specific fields removed — **BREAKING**
- **TypeScript types**: `WorkspaceConfig` → `ProjectConfig` (slimmed down), `CodeCorralConfig.workspaces` → `CodeCorralConfig.projects`
- **CLI**: `codecorral workspaces` → `codecorral projects`
- **Nix**: `programs.codecorral.workspaces` → `programs.codecorral.projects` with full `agent_deck`, `claude_code`, `openspec` pass-through sections
- **Tests**: Config loader and CLI integration tests updated for new terminology and slimmed config
- **README**: New section documenting project declaration via HM module with full pass-through examples
