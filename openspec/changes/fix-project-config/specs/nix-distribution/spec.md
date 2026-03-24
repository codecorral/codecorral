## MODIFIED Requirements

### Requirement: Home Manager module for project configuration
The Nix flake SHALL expose a Home Manager module (`homeManagerModules.codecorral`) that generates `~/.codecorral/config.yaml` from declarative Nix expressions and delegates tool-specific configuration to upstream Nix modules. The module SHALL use `programs.codecorral.enable` as its activation guard. The generated config file SHALL be valid YAML and SHALL contain only engine-own state (path, workflows, profile references). Tool-specific settings SHALL be delegated fully to upstream modules as a pass-through.

#### Scenario: HM module generates config.yaml with engine-own state
- **WHEN** the user's Home Manager configuration includes:
  ```nix
  programs.codecorral.enable = true;
  programs.codecorral.projects.my-project = {
    path = "/path/to/project";
    workflows = [ "intent" "unit" ];
    agent_deck.conductor.enable = true;
    claude_code.settings.model = "claude-sonnet-4-6";
  };
  ```
- **THEN** `home-manager switch` generates `~/.codecorral/config.yaml` containing only `path`, `workflows`, and `agent_deck_profile` for the project — not the agent-deck or claude-code settings

#### Scenario: Generated config is valid YAML
- **WHEN** the HM module generates `~/.codecorral/config.yaml`
- **THEN** the file is valid, human-readable YAML with proper indentation (not JSON serialized via `builtins.toJSON`)

#### Scenario: Full pass-through to agent-deck
- **WHEN** a project declares `agent_deck` settings (shell, conductor, mcps, docker, logs, worktree, etc.)
- **THEN** the module sets `programs.agent_deck.profiles.<project_name>` with all declared settings passed through. The module auto-sets `claude.config_dir = ".claude-<project_name>"` unless the user explicitly overrides it.

#### Scenario: Full pass-through to claude-code
- **WHEN** a project declares `claude_code` settings (settings, agents, rules, skills, etc.)
- **THEN** the module sets `programs.claude_code.profiles.<project_name>` with all declared settings passed through. The module auto-sets `config_dir = ".claude-<project_name>"` unless the user explicitly overrides it.

#### Scenario: Shared config_dir convention
- **WHEN** a project is declared without explicit `config_dir` overrides on either `agent_deck` or `claude_code`
- **THEN** both `programs.agent_deck.profiles.<name>.claude.config_dir` and `programs.claude_code.profiles.<name>.config_dir` are set to `.claude-<project_name>`, ensuring they share the same Claude identity

#### Scenario: Full pass-through to openspec
- **WHEN** a project declares `openspec.schemas`
- **THEN** the module sets `programs.openspec.schemas` to the union of all project schema lists, and the upstream openspec module installs them globally

#### Scenario: Upstream module not imported
- **WHEN** `programs.agent_deck` is not imported in the user's HM config but a project declares `agent_deck` settings
- **THEN** the delegation is skipped without error

#### Scenario: Duplicate profile names rejected
- **WHEN** two projects would produce the same profile name
- **THEN** `home-manager switch` fails with an assertion error: "Duplicate profile names across projects"

### Requirement: Nix flake exposes engine package
The Nix flake SHALL expose the `codecorral` CLI as a package (`packages.${system}.codecorral`) that can be built and installed via Nix. The package SHALL build using Bun as the TypeScript compiler and runtime, with a proper dependency hash for reproducible builds.

#### Scenario: Build engine package
- **WHEN** the user runs `nix build .#codecorral`
- **THEN** a result directory contains the `codecorral` binary with all dependencies bundled and the build completes without errors

#### Scenario: Install via Nix flake
- **WHEN** the user runs `nix profile install .#codecorral`
- **THEN** the `codecorral` binary is available on PATH and can execute all CLI commands
