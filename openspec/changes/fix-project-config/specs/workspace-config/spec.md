## RENAMED Requirements

### Requirement: Config file format
FROM: Config file format
TO: Config file format

## MODIFIED Requirements

### Requirement: Config file format
The engine SHALL read project configuration from `~/.codecorral/config.yaml`. The config file SHALL use snake_case for all keys. The config file SHALL define projects as a map keyed by project name under the `projects:` key. Each project specifies a `path`, optional `workflows` list, optional `agent_deck_profile` (string reference to the profile name), and optional `openspec` section with `schemas_path`. Tool-specific configuration (agent-deck settings, claude-code settings, openspec schemas) SHALL NOT appear in `config.yaml` — that configuration is owned by the upstream modules.

#### Scenario: Parse valid config file
- **WHEN** the engine reads a `config.yaml` with two project entries under the `projects:` key
- **THEN** each project is loaded with its path, workflows, and agent-deck profile reference

#### Scenario: Minimal project config
- **WHEN** a project entry specifies only `path`
- **THEN** the project is loaded with the path and all optional fields default to null/empty

#### Scenario: Config file does not exist
- **WHEN** `~/.codecorral/config.yaml` does not exist
- **THEN** the engine starts with an empty project list and no error

#### Scenario: Config uses snake_case keys
- **WHEN** the engine reads a `config.yaml` with keys `projects`, `agent_deck_profile`, `schemas_path`
- **THEN** all keys are parsed correctly using snake_case convention

### Requirement: Config merging across levels
The engine SHALL support config at two levels: user-level (`~/.codecorral/config.yaml`) and project-level (`.codecorral/config.yaml` within a project directory). When both exist for the same project, project-level settings SHALL take precedence for project-specific fields.

#### Scenario: Project config overrides user config
- **WHEN** user-level config defines `projects.my-project.workflows: ["intent"]` and project-level config defines `workflows: ["intent", "unit"]`
- **THEN** the effective workflows for that project are `["intent", "unit"]`

#### Scenario: User config provides defaults
- **WHEN** user-level config defines `projects.my-project.agent_deck_profile: my-project` and project-level config has no `agent_deck_profile`
- **THEN** the effective agent_deck_profile is `my-project`

## REMOVED Requirements

### Requirement: Agent-deck profile configuration per workspace
**Reason**: Agent-deck global settings are configured directly via `programs.agent-deck` (not proxied through CodeCorral). Per-project agent-deck is limited to `claude.config_dir` (auto-set by convention). The engine's `config.yaml` only stores the profile name reference.
**Migration**: Set global agent-deck settings directly via `programs.agent-deck` in your HM config. Per-project profile creation is automatic.

### Requirement: Claude Code profile configuration per workspace
**Reason**: Claude Code configuration is now a full pass-through to agentplot-kit's `programs.claude_code.profiles.<name>` via the HM module. The engine's `config.yaml` does not store claude-code settings.
**Migration**: Declare claude-code settings in `programs.codecorral.projects.<name>.claude_code` (Nix) which delegates to `programs.claude_code.profiles.<name>`.

### Requirement: OpenSpec schema configuration per workspace
**Reason**: OpenSpec schema configuration is delegated to the upstream `programs.openspec` module. Only `schemas_path` (project-local, engine-relevant) remains in `config.yaml`.
**Migration**: Declare schemas in `programs.codecorral.projects.<name>.openspec.schemas` (Nix) which delegates to `programs.openspec.schemas`.
