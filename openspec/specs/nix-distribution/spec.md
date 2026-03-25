## ADDED Requirements

### Requirement: Nix flake exposes engine package
The Nix flake SHALL expose the `codecorral` CLI as a package (`packages.${system}.codecorral`) that can be installed via `nix profile install`. The package SHALL include the engine daemon, CLI, and built-in workflow definitions.

#### Scenario: Install via Nix flake
- **WHEN** the user runs `nix profile install .#codecorral`
- **THEN** the `codecorral` binary is available on PATH and can execute all CLI commands

#### Scenario: Build engine package
- **WHEN** the user runs `nix build .#codecorral`
- **THEN** a result directory contains the `codecorral` binary with all dependencies bundled

### Requirement: Home Manager module for project configuration
The Nix flake SHALL expose a Home Manager module (`homeManagerModules.codecorral`) that generates `~/.codecorral/config.yaml` from declarative Nix expressions and delegates tool-specific configuration to upstream Nix modules. The module SHALL use `programs.codecorral.enable` as its activation guard. The module SHALL require agentplot-kit's claude-code HM module (not the upstream nix-community one) for profile support. The generated config file SHALL be valid YAML and SHALL contain only engine-own state. Tool-specific settings SHALL be delegated to upstream modules as a per-project pass-through.

#### Scenario: HM module generates config.yaml with engine-own state
- **WHEN** the user's Home Manager configuration includes:
  ```nix
  programs.codecorral.enable = true;
  programs.codecorral.projects.my-project = {
    path = "/path/to/project";
    workflows = [ "intent" "unit" ];
    claude_code.settings.model = "claude-sonnet-4-6";
  };
  ```
- **THEN** `home-manager switch` generates `~/.codecorral/config.yaml` containing only `path`, `workflows`, and `agent_deck_profile` for the project — not claude-code settings

#### Scenario: Per-project agent-deck profile creation
- **WHEN** a project is declared
- **THEN** the module creates `programs.agent-deck.profiles.<project_name>.claude.config_dir` set to `.claude-<project_name>` via `lib.mkDefault`

#### Scenario: Per-project claude-code full pass-through
- **WHEN** a project declares `claude_code` with settings, agents, rules, skills, or other options
- **THEN** the module passes all settings through to `programs.claude-code.profiles.<project_name>.*` and auto-sets `config_dir` via `lib.mkDefault`

#### Scenario: Upstream module not imported
- **WHEN** `programs.agent-deck` is not available in the user's HM config
- **THEN** per-project agent-deck profile creation is skipped without error

#### Scenario: Duplicate profile names rejected
- **WHEN** two projects would produce the same profile name
- **THEN** `home-manager switch` fails with an assertion error

#### Scenario: HM module ensures schema package availability
- **WHEN** a project references `openspec.schemas = [ "dev.codecorral.intent@2026-03-11.0" ]`
- **THEN** the HM module sets `programs.openspec.schemas` to the union of all project schema lists, and the upstream openspec module installs them globally

### Requirement: npm package for non-Nix installation
The engine SHALL be published as an npm package with a `bin` entry for `codecorral`. Users SHALL be able to run `npx codecorral` or install globally via `npm install -g codecorral`.

#### Scenario: Run via npx
- **WHEN** the user runs `npx codecorral status`
- **THEN** the CLI executes without requiring Nix, Home Manager, or any other CodeCorral infrastructure

#### Scenario: Global npm install
- **WHEN** the user runs `npm install -g codecorral` followed by `codecorral status`
- **THEN** the CLI is available globally and connects to or starts the engine daemon

### Requirement: Consistent behavior across installation methods
The `codecorral` CLI SHALL behave identically whether installed via Nix or npm. The only difference SHALL be configuration: Nix users get declarative config via HM module, npm users write `~/.codecorral/config.yaml` manually.

#### Scenario: Same CLI output from both install methods
- **WHEN** the same command is run from a Nix-installed and npm-installed `codecorral` against the same daemon
- **THEN** the output is identical
