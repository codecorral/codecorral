## ADDED Requirements

### Requirement: Home Manager module installs schemas
The flake SHALL export a Home Manager module that installs OpenSpec schemas to the user-level override directory via `xdg.dataFile`.

#### Scenario: Schemas installed via Home Manager
- **WHEN** a user adds the codecorral Home Manager module to their configuration and runs `home-manager switch`
- **THEN** `~/.local/share/openspec/schemas/intent/schema.yaml` SHALL exist and be a symlink to the Nix store

#### Scenario: Schema resolves from user tier
- **WHEN** schemas are installed via Home Manager
- **AND** the user runs `openspec schema which intent` in any project
- **THEN** the schema SHALL resolve with source `user`

### Requirement: Module is configurable
The Home Manager module SHALL allow users to select which schemas to install, defaulting to all available schemas.

#### Scenario: Default installs all schemas
- **WHEN** a user enables the module without specifying schemas
- **THEN** all schemas in the package SHALL be installed

#### Scenario: Selective schema installation
- **WHEN** a user sets `programs.openspec.schemas = ["intent"]`
- **THEN** only the `intent` schema SHALL be installed

### Requirement: Project-local schemas take precedence
The Home Manager module SHALL NOT interfere with project-local schema resolution. Project-local schemas at `./openspec/schemas/<name>/` SHALL continue to take precedence over user-level schemas.

#### Scenario: Project-local override
- **WHEN** a project has `openspec/schemas/intent/schema.yaml` locally
- **AND** the same schema is installed via Home Manager
- **THEN** `openspec schema which intent` SHALL resolve from `project`, not `user`
