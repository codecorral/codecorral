## 1. Migrate schemas into programs.codecorral

- [x] 1.1 Add `schemas` option to `nix/codecorral-hm-module.nix`: `programs.codecorral.schemas` (list of strings, default `[]`) and `programs.codecorral.schema_package` (package, default from flake). Change module to curried form `flake: { config, lib, pkgs, ... }:` to access the flake's schema package.
- [x] 1.2 Add schema installation logic to `codecorral-hm-module.nix` config block: select schemas (empty = all), generate `xdg.dataFile` entries for each schema (same logic as current `hm-module.nix`).
- [x] 1.3 Add `mkRenamedOptionModule` in `flake.nix` so `programs.openspec.enable` → `programs.codecorral.enable`, `programs.openspec.schemas` → `programs.codecorral.schemas`, `programs.openspec.schemaPackage` → `programs.codecorral.schema_package`. Keep `homeManagerModules.openspec` as an alias that imports the renamed module.
- [x] 1.4 Update `flake.nix` to pass `self` to the codecorral module: `homeManagerModules.codecorral = import ./nix/codecorral-hm-module.nix self;`
- [x] 1.5 Remove `nix/hm-module.nix` (its logic is now in `codecorral-hm-module.nix`).
- [x] 1.6 Update README: migration guidance for `programs.openspec` → `programs.codecorral.schemas`.

## 2. Remove per-project openspec from project type

- [x] 2.1 Remove `openspec` option from `projectType` submodule in `nix/codecorral-hm-module.nix`.
- [x] 2.2 Remove `allSchemas` union logic and per-project openspec delegation block from `codecorral-hm-module.nix`.
- [x] 2.3 Remove `openspec.schemas_path` from config.yaml generation (`configData`).
- [x] 2.4 Remove `openspec_schemas_path` from `ProjectConfig` in `src/actors/types.ts`.
- [x] 2.5 Update `test/config/loader.test.ts` if any fixtures reference `openspec_schemas_path` or per-project openspec.

## 3. Author deck YAML and conductor files

- [x] 3.1 Create `decks/codecorral.deck.yaml` defining 6-group AI-DLC layout: clint (with foreman conductor), exploration, backlogs, elaboration, construction, operations. Groups start with minimal/empty sessions — sessions are created dynamically by the conductor at runtime. The `claude_md` for the foreman points to `./conductors/foreman.md` (relative path).
- [x] 3.2 Create `decks/conductors/foreman.md` with default conductor instructions (minimal placeholder — polls task board, delegates work, routes approvals).
- [x] 3.3 Add `conductors` option to `projectType` in HM module: `attrsOf (submodule { claude_md = nullOr path, default null; policy_md = nullOr path, default null; })`, default `{}`. Supports multiple conductors; start with foreman. When set, overrides the corresponding conductor's `claude_md` and/or `policy_md` in the deck YAML for that project.
- [x] 3.4 Add `packages.codecorral-deck` to `flake.nix` — a `pkgs.runCommand` that bundles `decks/` into a Nix derivation.
- [x] 3.5 Validate deck with `shuffle validate decks/codecorral.deck.yaml`.

## 4. Add shuffle activation to HM module

- [x] 4.1 Add `shuffle` as a flake input in `flake.nix`: `shuffle.url = "github:codecorral/shuffle"`. Pass it to the HM module.
- [x] 4.2 Add per-project deck derivation logic: for each project, create a derivation that copies the base deck YAML and resolves the conductor policy (user override or bundled default). This ensures shuffle sees the correct `claude_md` path per project.
- [x] 4.3 Add `home.activation.codecorral-deck` DAG entry in `codecorral-hm-module.nix`: iterate `cfg.projects`, run `shuffle deal --profile <name> <project-deck-path>` for each. Use `lib.hm.dag.entryAfter ["writeBoundary"]`. Wrap with `$DRY_RUN_CMD` and `|| $VERBOSE_ECHO "warning: ..."` error handling.
- [x] 4.4 Only run activation if `cfg.projects != {}` (skip if no projects configured).

## 5. Documentation and cleanup

- [x] 5.1 Update README: document that `home-manager switch` automatically provisions agent-deck session layouts for each project. Add migration guidance for `programs.openspec` → `programs.codecorral.schemas`. Add conductor override example.
- [x] 5.2 Update CLAUDE.md and README project structure to include `decks/` directory.

## 6. Verification

- [x] 6.1 Run `bun run typecheck` — no type errors.
- [x] 6.2 Run `bun test` — all tests pass.
- [x] 6.3 Run `nix flake check` — flake validation passes.
- [x] 6.4 Verify HM module parses as valid Nix.
- [x] 6.5 Verify `shuffle validate decks/codecorral.deck.yaml` passes.
