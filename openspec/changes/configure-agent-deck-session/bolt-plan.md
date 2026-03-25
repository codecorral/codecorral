## Execution Plan

| Wave | Unit | Priority | Dependencies | Complexity |
|------|------|----------|--------------|------------|
| 1 | openspec-namespace-migration | P1 | None | S |
| 1 | deck-yaml-authoring | P2 | None | M |
| 2 | hm-deck-profiles | P1 | openspec-namespace-migration, deck-yaml-authoring | M |

**Wave 1** — Two parallel units with no dependencies:
- **openspec-namespace-migration** (P1, Small): Merge `programs.openspec` into `programs.codecorral.schemas` with `mkRenamedOptionModule`. Low risk, clears the path for the unified namespace. Do first because hm-deck-profiles builds on it.
- **deck-yaml-authoring** (P2, Medium): Author the 6-group `codecorral.deck.yaml` and conductor `.md` files. Can be tested independently with `shuffle validate` / `shuffle diff`. Medium because it requires understanding the AI-DLC session layout and conductor definitions.

**Wave 2** — Depends on both Wave 1 units:
- **hm-deck-profiles** (P1, Medium): The integration unit — adds `profiles.<name>.decks` to the HM module, wires up shuffle as a flake input, implements the activation script. Depends on the unified namespace (Wave 1a) and having a deck to test against (Wave 1b).

## Bead Creation

Each unit becomes one elaboration bead dispatched to Loop 2 (spec-driven schema).

| Bead Label | Unit Brief Path | Notes |
|------------|-----------------|-------|
| `configure-agent-deck-session/openspec-namespace-migration` | `units/openspec-namespace-migration/unit-brief.md` | Small refactor — single spec-driven change touching `nix/codecorral-hm-module.nix`, `nix/hm-module.nix`, `flake.nix`, README |
| `configure-agent-deck-session/deck-yaml-authoring` | `units/deck-yaml-authoring/unit-brief.md` | Content authoring + Nix packaging — needs knowledge of AI-DLC session layout and shuffle deck format |
| `configure-agent-deck-session/hm-deck-profiles` | `units/hm-deck-profiles/unit-brief.md` | HM module integration — shuffle flake input, activation script, error handling, dry-run support |

**Dispatch order:** Wave 1 beads can be dispatched immediately in parallel. Wave 2 bead dispatches after both Wave 1 beads complete.

**Note on shuffle prerequisites:** All four shuffle issues (#1 `--profile`, #2 Nix packaging, #3 error handling, #4 file paths) are closed as of 2026-03-24. No external blockers remain.
