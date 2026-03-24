## RENAMED Requirements

### Requirement: Config file format
FROM: Config file format
TO: Config file format

## MODIFIED Requirements

### Requirement: Config file format
The engine SHALL read project configuration from `~/.codecorral/config.yaml`. The config file SHALL define projects as a map keyed by project name under the `projects:` key. Each project specifies a `path`, optional `workflows` list, optional `agent_deck_profile` (reference name), and optional `openspec` section with `schemas_path`. Tool-specific configuration (agent-deck settings, claude-code settings, openspec schemas) SHALL NOT appear in `config.yaml` — that configuration is owned by the upstream modules.

#### Scenario: Parse valid config file
- **WHEN** the engine reads a `config.yaml` with two project entries under the `projects:` key
- **THEN** each project is loaded with its path, workflows, and agent-deck profile reference

#### Scenario: Minimal project config
- **WHEN** a project entry specifies only `path`
- **THEN** the project is loaded with the path and all optional fields default to null/empty

#### Scenario: Config file does not exist
- **WHEN** `~/.codecorral/config.yaml` does not exist
- **THEN** the engine starts with an empty project list and no error

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
**Reason**: Agent-deck configuration is now a full pass-through to the upstream `programs.agent-deck` module via the HM module's delegation. The engine's `config.yaml` only stores the profile name reference, not the profile contents.
**Migration**: Declare agent-deck settings in `programs.codecorral.projects.<name>.agent_deck` (Nix) which delegates to `programs.agent-deck.profiles.<name>`.

### Requirement: Claude Code profile configuration per workspace
**Reason**: Claude Code configuration is now a full pass-through to the upstream `programs.claude-code` module via the HM module's delegation. The engine's `config.yaml` does not store claude-code settings.
**Migration**: Declare claude-code settings in `programs.codecorral.projects.<name>.claude_code` (Nix) which delegates to `programs.claude-code.profiles.<name>`.

### Requirement: OpenSpec schema configuration per workspace
**Reason**: OpenSpec schema configuration is now delegated to the upstream `programs.openspec` module. Only `schemas_path` (project-local, engine-relevant) remains in `config.yaml`.
**Migration**: Declare schemas in `programs.codecorral.projects.<name>.openspec.schemas` (Nix) which delegates to `programs.openspec.schemas`.
