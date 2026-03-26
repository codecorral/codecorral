## Execution Plan

| Wave | Unit | Priority | Dependencies | Complexity |
|------|------|----------|--------------|------------|
| 1 | openspec-namespace-migration | P1 | None | S |
| 1 | deck-yaml-authoring | P2 | None | M |
| 2 | hm-deck-activation | P1 | openspec-namespace-migration, deck-yaml-authoring | M |

**Wave 1** — Two parallel units with no dependencies:
- **openspec-namespace-migration** (P1, Small): Merge `programs.openspec` into `programs.codecorral.schemas` with `mkRenamedOptionModule`. Also removes premature per-project `openspec` options from the project type (schemas are global, not per-project). Low risk, clears the path for the unified namespace.
- **deck-yaml-authoring** (P2, Medium): Author the 6-group `codecorral.deck.yaml` and conductor `.md` files. Can be tested independently with `shuffle validate` / `shuffle diff`. Medium because it requires understanding the AI-DLC session layout and conductor definitions.

**Wave 2** — Depends on both Wave 1 units:
- **hm-deck-activation** (P1, Medium): The integration unit — adds shuffle as a flake input and implements an HM activation script that automatically runs `shuffle deal` for each project's agent-deck profile using the bundled deck YAML. No user-facing deck options — CodeCorral applies the fixed layout behind the scenes.

## Bead Creation

Each unit becomes one elaboration bead dispatched to Loop 2 (spec-driven schema).

| Bead Label | Unit Brief Path | Notes |
|------------|-----------------|-------|
| `configure-agent-deck-session/openspec-namespace-migration` | `units/openspec-namespace-migration/unit-brief.md` | Small refactor — touches `nix/codecorral-hm-module.nix`, `nix/hm-module.nix`, `flake.nix`, `src/actors/types.ts`, README |
| `configure-agent-deck-session/deck-yaml-authoring` | `units/deck-yaml-authoring/unit-brief.md` | Content authoring + Nix packaging — needs knowledge of AI-DLC session layout and shuffle deck format |
| `configure-agent-deck-session/hm-deck-activation` | `units/hm-deck-activation/unit-brief.md` | HM activation script — shuffle flake input, automatic deal for each project, error handling, dry-run support |

**Dispatch order:** Wave 1 beads can be dispatched immediately in parallel. Wave 2 bead dispatches after both Wave 1 beads complete.

**Note on shuffle prerequisites:** All four shuffle issues (#1 `--profile`, #2 Nix packaging, #3 error handling, #4 file paths) are closed. No external blockers remain.
