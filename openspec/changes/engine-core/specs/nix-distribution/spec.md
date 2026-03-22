## ADDED Requirements

### Requirement: Nix flake exposes engine package
The Nix flake SHALL expose the `codecorral` CLI as a package (`packages.${system}.codecorral`) that can be installed via `nix profile install`. The package SHALL include the engine daemon, CLI, and built-in workflow definitions.

#### Scenario: Install via Nix flake
- **WHEN** the user runs `nix profile install .#codecorral`
- **THEN** the `codecorral` binary is available on PATH and can execute all CLI commands

#### Scenario: Build engine package
- **WHEN** the user runs `nix build .#codecorral`
- **THEN** a result directory contains the `codecorral` binary with all dependencies bundled

### Requirement: Home Manager module for workspace configuration
The Nix flake SHALL expose a Home Manager module (`homeManagerModules.codecorral`) that generates `~/.codecorral/config.yaml` from declarative Nix expressions. The module SHALL use `programs.codecorral.enable` as its activation guard. The module SHALL delegate tool-specific configuration to upstream Nix modules (`programs.agent-deck`, `programs.claude-code`, `programs.openspec`) rather than reimplementing their config generation.

#### Scenario: HM module generates config.yaml
- **WHEN** the user's Home Manager configuration includes:
  ```nix
  programs.codecorral.enable = true;
  programs.codecorral.workspaces.my-project = {
    path = "/path/to/project";
    workflows = [ "intent" "unit" ];
  };
  ```
- **THEN** `home-manager switch` generates `~/.codecorral/config.yaml` with the workspace definition

#### Scenario: Delegation to upstream modules
- **WHEN** a workspace configures `agentDeck.profile = "my-project"` and `claudeCode.profile = { model = "claude-sonnet-4-6"; }`
- **THEN** the CodeCorral module sets `programs.agent-deck.profiles.my-project` and `programs.claude-code.profiles.my-project` on the upstream modules. The upstream modules generate their own config files.

#### Scenario: Upstream module not imported
- **WHEN** `programs.agent-deck` is not imported in the user's HM config but a workspace references `agentDeck.profile`
- **THEN** the delegation is skipped and `home-manager switch` produces a warning (not an error)

#### Scenario: Duplicate profile names rejected
- **WHEN** two workspaces both map to `agentDeck.profile = "shared"`
- **THEN** `home-manager switch` fails with an assertion error: "Duplicate agentDeck profile 'shared' across workspaces"

#### Scenario: HM module ensures schema package availability
- **WHEN** a workspace references `openspec.schemas = [ "dev.codecorral.intent@2026-03-11.0" ]`
- **THEN** the HM module sets `programs.openspec.schemas` to the union of all workspace schema lists, and the upstream openspec module installs them globally

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
