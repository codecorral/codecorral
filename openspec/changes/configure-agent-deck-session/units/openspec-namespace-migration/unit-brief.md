## Unit: openspec-namespace-migration

**Description:** Migrate `programs.openspec` schema distribution into `programs.codecorral.schemas` using `mkRenamedOptionModule` for backwards compatibility. This unifies all CodeCorral HM concerns under a single namespace. The `programs.codecorral` module already exists (from fix-project-config) with `projects` support — this unit adds the `schemas` sub-option.

**Deliverable:** `programs.codecorral.schemas` option that replaces `programs.openspec` for schema distribution, with deprecation warnings for existing users via `mkRenamedOptionModule`. The existing `homeManagerModules.openspec` continues to work but emits a deprecation warning pointing to `homeManagerModules.codecorral`.

**Dependencies:** None

## Relevant Requirements

- UC1 (First-time setup): Users should have one cohesive import for all CodeCorral concerns
- UC5 (Multi-profile): Schemas and deck profiles should be under a single `programs.codecorral` namespace
- NFR (Backwards compatibility): Migration from `programs.openspec` must use `mkRenamedOptionModule` for deprecation warnings rather than silent breakage
- Boundary: No changes to the OpenSpec CLI — it consumes schemas from the same XDG path regardless of which module installed them

## System Context

- `nix/hm-module.nix` currently implements `programs.openspec` with `enable`, `schemas`, and `schemaPackage` options
- `nix/codecorral-hm-module.nix` implements `programs.codecorral` with `enable` and `projects` — this unit extends it with `schemas`
- `flake.nix` currently exports both `homeManagerModules.openspec` and `homeManagerModules.codecorral` — after this unit, `homeManagerModules.codecorral` handles both schemas and projects
- The openspec module generates `xdg.dataFile` entries for schema symlinks — this mechanism stays the same

## Scope Boundaries

**In scope:**
- Add `programs.codecorral.schemas` sub-option (enable, schemas list, schemaPackage) to `codecorral-hm-module.nix`
- Add `mkRenamedOptionModule` for `programs.openspec` → `programs.codecorral.schemas`
- Keep `homeManagerModules.openspec` export in `flake.nix` as an alias that imports the renamed module
- Update README with migration guidance

**Out of scope:**
- Removing `homeManagerModules.openspec` entirely (keep for backwards compat)
- Changing how schemas are installed (XDG dataFile mechanism stays the same)
- Deck profiles (separate unit)
