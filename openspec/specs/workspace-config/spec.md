## ADDED Requirements

### Requirement: Config file format
The engine SHALL read workspace configuration from `~/.codecorral/config.yaml`. The config file SHALL define workspaces as a map keyed by workspace name, where each workspace specifies a `path`, optional `workflows` list, optional `agentDeck` profile config, optional `claudeCode` profile config, and optional `openspec` schema config.

#### Scenario: Parse valid config file
- **WHEN** the engine reads a `config.yaml` with two workspace entries
- **THEN** each workspace is loaded with its path, workflows, agentDeck profile, claudeCode profile, and openspec configuration

#### Scenario: Minimal workspace config
- **WHEN** a workspace entry specifies only `path`
- **THEN** the workspace is loaded with the path and all optional fields default to null/empty

#### Scenario: Config file does not exist
- **WHEN** `~/.codecorral/config.yaml` does not exist
- **THEN** the engine starts with an empty workspace list and no error

### Requirement: Agent-deck profile configuration per workspace
Each workspace MAY declare an `agentDeck` section with `profile` (profile name for agent-deck session management). This configuration is declarative — the engine reads it; later units (session-integration) consume it for session creation.

#### Scenario: Workspace with agent-deck profile
- **WHEN** a workspace defines `agentDeck.profile: my-project`
- **THEN** the engine stores the profile name as part of the workspace configuration, accessible via `codecorral workspaces`

### Requirement: Claude Code profile configuration per workspace
Each workspace MAY declare a `claudeCode` section with `model` (default model for agents) and `apiKey` (API key or secret reference). This configuration is declarative — consumed by later units for session creation.

#### Scenario: Workspace with Claude Code profile
- **WHEN** a workspace defines `claudeCode.model: claude-sonnet-4-6`
- **THEN** the engine stores the model setting as part of the workspace configuration

### Requirement: OpenSpec schema configuration per workspace
Each workspace MAY declare an `openspec` section with `schemas` (list of schema references), `schemasPath` (relative path to project-local schemas), and `config` (overrides like `defaultSchema`). This is declarative — the HM module ensures schemas are installed.

#### Scenario: Workspace with OpenSpec schemas
- **WHEN** a workspace defines `openspec.schemas: ["dev.codecorral.intent@2026-03-11.0"]` and `openspec.schemasPath: ./openspec/schemas`
- **THEN** the engine stores both the schema list and the project-local schema path in the workspace configuration

### Requirement: Config merging across levels
The engine SHALL support config at two levels: user-level (`~/.codecorral/config.yaml`) and project-level (`.codecorral/config.yaml` within a project directory). When both exist for the same workspace, project-level settings SHALL take precedence for project-specific fields.

#### Scenario: Project config overrides user config
- **WHEN** user-level config defines `workspaces.my-project.claudeCode.model: claude-sonnet-4-6` and project-level config defines `claudeCode.model: claude-opus-4-6`
- **THEN** the effective model for that workspace is `claude-opus-4-6`

#### Scenario: User config provides defaults
- **WHEN** user-level config defines `workspaces.my-project.agentDeck.profile: my-project` and project-level config has no `agentDeck` section
- **THEN** the effective agentDeck profile is `my-project`
