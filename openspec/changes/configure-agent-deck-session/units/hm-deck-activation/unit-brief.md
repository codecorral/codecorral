## Unit: hm-deck-activation

**Description:** Add an HM activation script to the CodeCorral module that automatically runs `shuffle deal --profile <project-name> <deck.yaml>` for each configured project during `home-manager switch`. The deck layout is fixed (CodeCorral's bundled 6-group AI-DLC layout) and not user-configurable — CodeCorral applies it behind the scenes for every project.

**Deliverable:** HM activation script in `codecorral-hm-module.nix` that iterates over `programs.codecorral.projects`, running shuffle deal for each project's agent-deck profile using the bundled deck YAML. Shuffle added as a flake input.

**Dependencies:** openspec-namespace-migration (unified namespace), deck-yaml-authoring (the bundled deck YAML must exist)

## Relevant Requirements

- UC1 (First-time setup): On `home-manager switch`, shuffle runs automatically, creating all 6 groups for each project's agent-deck profile
- UC2 (Layout evolution): Developer updates CodeCorral (which may include an updated deck YAML), runs `home-manager switch`, shuffle applies changes additively
- NFR (Graceful degradation): If agent-deck is not running or shuffle fails, activation must not fail. Wrap with `|| { warn; }`
- NFR (Activation speed): Shuffle deal completes in seconds
- NFR (Activation ordering): Must use `lib.hm.dag.entryAfter ["writeBoundary"]` so deck file exists before shuffle runs
- NFR (File path integrity): Deck YAML references to conductor `.md` files must resolve from Nix store
- NFR (Idempotency): Running `home-manager switch` repeatedly with no changes produces no side effects
- Constraint: Must respect `$DRY_RUN_CMD` for `home-manager switch --dry-run`

## System Context

- `nix/codecorral-hm-module.nix` is the target file — gains an activation script (no new user-facing options)
- `flake.nix` needs `shuffle` as a flake input so the activation script can call it
- The bundled deck YAML (from deck-yaml-authoring unit) is referenced from the Nix store
- Activation scripts are HM DAG entries run during `home-manager switch` with `set -e`
- Shuffle's `--profile` flag binds the deck to the project's agent-deck profile name
- Each project in `programs.codecorral.projects` gets the same fixed deck layout applied to its agent-deck profile

## Scope Boundaries

**In scope:**
- Add shuffle as a flake input (`codecorral/shuffle`)
- Bundle the deck YAML + referenced files as a Nix derivation
- Implement HM activation script: iterate projects, run `shuffle deal --profile <project-name> <deck.yaml>`
- Activation ordering via `entryAfter ["writeBoundary"]`
- Error wrapping: `|| { warn "shuffle failed for project <name>"; }`
- Dry-run support: check `$DRY_RUN_CMD`

**Out of scope:**
- User-configurable deck options (deck is fixed, not an option)
- Deck YAML content (separate unit)
- Schema distribution (separate unit)
- Deletion/cleanup of removed sessions (shuffle is additive-only)
- Per-project deck customization (all projects get the same layout)
