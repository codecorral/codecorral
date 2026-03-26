## Why

CodeCorral's HM module (`programs.codecorral`) manages per-project claude-code delegation but has two gaps: (1) schema distribution still lives in a separate `programs.openspec` module — a fragmented namespace that misleads users since it lives in the codecorral repo; (2) there's no declarative mechanism to configure agent-deck session layouts — users must manually create groups, sessions, and conductors via CLI, which drifts from the intended 6-group AI-DLC layout over time.

Shuffle (codecorral/shuffle) solves the layout problem — it applies deck YAML files idempotently via `shuffle deal`. All shuffle prerequisites are done (issues #1-4 closed). What's missing is the Nix integration: adding shuffle as a flake input, bundling the deck YAML, and running `shuffle deal` automatically during `home-manager switch`.

## What Changes

- Migrate `programs.openspec` schema distribution into `programs.codecorral.schemas` (global, not per-project) with `mkRenamedOptionModule` for backwards compatibility
- Remove premature per-project `openspec` options from the project type (schemas are global)
- Author `decks/codecorral.deck.yaml` defining the 6-group AI-DLC session layout (clint, exploration, backlogs, elaboration, construction, operations) with conductor sessions and MCP attachments
- Add shuffle as a flake input and bundle the deck YAML as a Nix derivation
- Add HM activation script that automatically runs `shuffle deal --profile <project-name>` for each configured project during `home-manager switch` — deck layout is fixed, not user-configurable

## Capabilities

### New Capabilities

- `hm-deck-activation`: Automatic agent-deck session layout provisioning via shuffle during HM activation

### Modified Capabilities

- `nix-distribution`: Migrate schema distribution into `programs.codecorral.schemas`, add shuffle flake input, add deck derivation, add activation script
- `project-config`: Remove per-project `openspec` options (schemas are global)

## Impact

- **Nix HM module**: `programs.codecorral` gains `schemas` option; `programs.openspec` becomes a deprecated alias
- **Nix flake**: shuffle added as input; deck YAML + conductor files bundled as derivation
- **TypeScript types**: `ProjectConfig` loses `openspec_schemas_path` field
- **Config loader**: Remove openspec-related parsing from project config
- **HM activation**: New DAG entry runs shuffle deal per project on `home-manager switch`
- **README**: Migration guidance for `programs.openspec` → `programs.codecorral.schemas`
