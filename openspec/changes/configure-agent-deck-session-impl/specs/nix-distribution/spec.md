## MODIFIED Requirements

### Requirement: Home Manager module for project configuration
The Nix flake SHALL expose a Home Manager module (`homeManagerModules.codecorral`) that generates `~/.codecorral/config.yaml`, delegates tool-specific configuration to upstream modules, distributes OpenSpec schemas via `xdg.dataFile`, and provisions agent-deck session layouts via shuffle activation. The module SHALL use `programs.codecorral.enable` as its activation guard.

The module SHALL provide a global `schemas` option for OpenSpec schema distribution (migrated from `programs.openspec`). The `programs.openspec` namespace SHALL continue to work via `mkRenamedOptionModule` with deprecation warnings.

#### Scenario: Global schema distribution
- **WHEN** the user declares `programs.codecorral.schemas = [ "dev.codecorral.intent@2026-03-11.0" ]`
- **THEN** the module installs the specified schemas to `~/.local/share/openspec/schemas/` via `xdg.dataFile`

#### Scenario: Default installs all schemas
- **WHEN** the user enables the module without specifying schemas (`programs.codecorral.schemas = []`)
- **THEN** all schemas in the schema package SHALL be installed

#### Scenario: Backwards-compatible migration from programs.openspec
- **WHEN** the user has `programs.openspec.enable = true` and `programs.openspec.schemas = [ ... ]`
- **THEN** the options forward to `programs.codecorral` via `mkRenamedOptionModule` with a deprecation warning

#### Scenario: Shuffle as flake input
- **WHEN** the CodeCorral flake is built
- **THEN** shuffle is available as a flake input and the bundled deck YAML is a Nix derivation

#### Scenario: HM activation runs shuffle deal per project
- **WHEN** `programs.codecorral.projects` has one or more projects configured
- **THEN** the HM activation script runs `shuffle deal --profile <project-name> <deck.yaml>` for each project after `writeBoundary`

#### Scenario: Activation respects dry-run
- **WHEN** the user runs `home-manager switch --dry-run`
- **THEN** the activation script prefixes shuffle commands with `$DRY_RUN_CMD` and does not modify agent-deck state

#### Scenario: Activation swallows shuffle failures
- **WHEN** shuffle deal fails (agent-deck not running, network issue, etc.)
- **THEN** the activation script logs a warning and continues without aborting `home-manager switch`

#### Scenario: No projects configured
- **WHEN** `programs.codecorral.projects` is empty
- **THEN** the activation script does not run shuffle deal
