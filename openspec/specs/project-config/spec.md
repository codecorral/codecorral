## ADDED Requirements

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
