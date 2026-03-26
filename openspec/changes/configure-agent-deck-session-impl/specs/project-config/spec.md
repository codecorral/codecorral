## MODIFIED Requirements

### Requirement: Config file format
The engine SHALL read project configuration from `~/.codecorral/config.yaml`. The config file SHALL use snake_case for all keys. The config file SHALL define projects as a map keyed by project name under the `projects:` key. Each project specifies a `path`, optional `workflows` list, and optional `agent_deck_profile` (string reference). The config file SHALL NOT contain openspec schema configuration — schemas are global, not per-project.

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
- **WHEN** the engine reads a `config.yaml` with keys `projects`, `agent_deck_profile`
- **THEN** all keys are parsed correctly using snake_case convention
