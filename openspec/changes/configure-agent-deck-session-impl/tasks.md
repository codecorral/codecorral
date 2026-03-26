## 1. Migrate schemas into programs.codecorral

- [x] 1.1 Add `schemas` option to `nix/codecorral-hm-module.nix`: `programs.codecorral.schemas` (list of strings, default `[]`) and `programs.codecorral.schema_package` (package, default from flake). Change module to curried form `flake: { config, lib, pkgs, ... }:` to access the flake's schema package.
- [x] 1.2 Add schema installation logic to `codecorral-hm-module.nix` config block: select schemas (empty = all), generate `xdg.dataFile` entries for each schema (same logic as current `hm-module.nix`).
- [x] 1.3 Add `mkRenamedOptionModule` in `flake.nix` so `programs.openspec.enable` → `programs.codecorral.enable`, `programs.openspec.schemas` → `programs.codecorral.schemas`, `programs.openspec.schemaPackage` → `programs.codecorral.schema_package`. Keep `homeManagerModules.openspec` as an alias that imports the renamed module.
- [x] 1.4 Update `flake.nix` to pass `self` to the codecorral module: `homeManagerModules.codecorral = import ./nix/codecorral-hm-module.nix self;`
- [x] 1.5 Remove `nix/hm-module.nix` (its logic is now in `codecorral-hm-module.nix`).
- [ ] 1.6 Update README: migration guidance for `programs.openspec` → `programs.codecorral.schemas`.

## 2. Remove per-project openspec from project type

- [x] 2.1 Remove `openspec` option from `projectType` submodule in `nix/codecorral-hm-module.nix`.
- [x] 2.2 Remove `allSchemas` union logic and per-project openspec delegation block from `codecorral-hm-module.nix`.
- [x] 2.3 Remove `openspec.schemas_path` from config.yaml generation (`configData`).
- [x] 2.4 Remove `openspec_schemas_path` from `ProjectConfig` in `src/actors/types.ts`.
- [x] 2.5 Update `test/config/loader.test.ts` if any fixtures reference `openspec_schemas_path` or per-project openspec.

## 3. Author deck YAML and conductor files

- [ ] 3.1 Create `decks/codecorral.deck.yaml` defining 6-group AI-DLC layout: clint (with foreman conductor), exploration, backlogs, elaboration, construction, operations. Groups start with minimal/empty sessions — sessions are created dynamically by the conductor at runtime.
- [ ] 3.2 Create `decks/conductors/foreman.md` with conductor instructions for the foreman (primary conductor that polls task board, delegates work).
- [ ] 3.3 Validate deck with `shuffle validate decks/codecorral.deck.yaml`.
- [ ] 3.4 Add `packages.codecorral-deck` to `flake.nix` — a `pkgs.runCommand` that bundles `decks/` into a Nix derivation.

## 4. Add shuffle activation to HM module

- [ ] 4.1 Add `shuffle` as a flake input in `flake.nix`: `shuffle.url = "github:codecorral/shuffle"`. Pass it to the HM module.
- [ ] 4.2 Add `home.activation.codecorral-deck` DAG entry in `codecorral-hm-module.nix`: iterate `cfg.projects`, run `shuffle deal --profile <name> <deck-path>` for each. Use `lib.hm.dag.entryAfter ["writeBoundary"]`.
- [ ] 4.3 Wrap shuffle calls with `$DRY_RUN_CMD` prefix and `|| $VERBOSE_ECHO "warning: ..."` error handling.
- [ ] 4.4 Only run activation if `cfg.projects != {}` (skip if no projects configured).

## 5. Documentation and cleanup

- [ ] 5.1 Update README: document that `home-manager switch` automatically provisions agent-deck session layouts for each project.
- [ ] 5.2 Update CLAUDE.md project structure to include `decks/` directory.

## 6. Verification

- [ ] 6.1 Run `bun run typecheck` — no type errors.
- [ ] 6.2 Run `bun test` — all tests pass.
- [ ] 6.3 Run `nix flake check` — flake validation passes.
- [ ] 6.4 Verify HM module parses as valid Nix.
- [ ] 6.5 Verify `shuffle validate decks/codecorral.deck.yaml` passes.
