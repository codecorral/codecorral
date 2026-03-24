## MODIFIED Requirements

### Requirement: Config file format
The engine SHALL read workspace configuration from `~/.codecorral/config.yaml`. The config file SHALL define workspaces as a map keyed by workspace name, where each workspace specifies a `path`, optional `workflows` list, optional `agentDeck` profile config, optional `claudeCode` profile config, optional `openspec` schema config, optional `board` URL string, and optional `conductors` array.

#### Scenario: Parse valid config file
- **WHEN** the engine reads a `config.yaml` with two workspace entries
- **THEN** each workspace is loaded with its path, workflows, agentDeck profile, claudeCode profile, openspec configuration, board URL, and conductors list

#### Scenario: Minimal workspace config
- **WHEN** a workspace entry specifies only `path`
- **THEN** the workspace is loaded with the path and all optional fields default to null/empty

#### Scenario: Config file does not exist
- **WHEN** `~/.codecorral/config.yaml` does not exist
- **THEN** the engine starts with an empty workspace list and no error

## ADDED Requirements

### Requirement: Board URL configuration per workspace
Each workspace MAY declare a `board` field with a URL string pointing to the project's tracking board (GitHub Projects, Linear, Jira, or any web-accessible board). This URL is used by the command center's browser panel.

#### Scenario: Workspace with board URL
- **WHEN** a workspace defines `board: https://github.com/orgs/example/projects/1`
- **THEN** the engine stores the board URL as part of the workspace configuration

#### Scenario: Workspace without board URL
- **WHEN** a workspace does not define a `board` field
- **THEN** the board URL defaults to null and the command center omits the browser panel

### Requirement: Conductors configuration per workspace
Each workspace MAY declare a `conductors` array where each entry has a `name` (the conductor session title used with `agent-deck session attach`). If omitted or empty, the command center terminal pane opens a shell instead of attaching to a conductor. A single `conductor` object with `name` SHALL be accepted as shorthand for a one-element `conductors` array.

#### Scenario: Workspace with multiple conductors
- **WHEN** a workspace defines `conductors: [{ name: conductor-frontend }, { name: conductor-backend }]`
- **THEN** the engine stores both conductor entries and the command center creates a tabbed pane with both

#### Scenario: Workspace with single conductor shorthand
- **WHEN** a workspace defines `conductor: { name: conductor-main }`
- **THEN** the engine normalizes this to a single-element conductors array

#### Scenario: Workspace without conductors
- **WHEN** a workspace does not define `conductors` or `conductor`
- **THEN** the conductors list defaults to empty and the command center terminal pane opens a shell
