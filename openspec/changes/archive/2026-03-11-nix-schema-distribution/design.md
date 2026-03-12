## Context

OpenSpec resolves schemas in three tiers: project-local, user override (`~/.local/share/openspec/schemas/`), and package built-in. Custom schemas like `intent` currently live only in the project that defines them. We need to distribute them to other projects without vendoring.

The system uses Nix with Home Manager for declarative system configuration. OpenSpec is already installed via Nix.

## Goals / Non-Goals

**Goals:**
- Distribute custom OpenSpec schemas to any project on a Nix-managed machine
- Use Home Manager's `xdg.dataFile` for declarative, symlink-based installation
- Keep schemas auto-updated when the flake input is updated

**Non-Goals:**
- Non-Nix distribution methods (npm, curl, etc.) — deferred to future work
- Modifying openspec's schema resolution logic
- Distributing schemas to other machines or CI (only local dev)

## Decisions

**D1: Use `xdg.dataFile` over shellHook**
Home Manager's `xdg.dataFile` creates symlinks in `~/.local/share/` declaratively. This is preferable to a devShell `shellHook` because:
- Works globally, not just inside `nix develop`
- No stale copies — symlinks always point to the current Nix store path
- Standard Home Manager pattern, not custom scripting
- Alternative considered: `shellHook` that copies schemas on shell entry — rejected because it creates mutable copies that drift

**D2: Package schemas as a simple `runCommand` derivation**
The schema package is a trivial copy derivation — no build step needed. Use `runCommand` (or `stdenv.mkDerivation` with just an install phase) to copy `openspec/schemas/*` into `$out/share/openspec/schemas/`.
- Alternative considered: using `symlinkJoin` — rejected because we want a flat copy in the store, not nested symlinks

**D3: Flake outputs both package and Home Manager module**
The flake exports:
- `packages.<system>.openspec-schemas` — the derivation
- `homeManagerModules.openspec` — the Home Manager module

Consumers add the flake as an input and import the module. The module references the package internally.

**D4: Use `programs.openspec` namespace following Home Manager conventions**
Home Manager convention: `programs.<name>` for user programs, `services.<name>` for daemons. OpenSpec is a program, not a service. The module follows standard HM patterns:
- `programs.openspec.enable` — bool, default false
- `programs.openspec.schemas` — list of schema names to install, default all
- `programs.openspec.schemaPackage` — the schema package derivation (default: the one from this flake)
- `meta.maintainers` — module maintainer list
- Alternative considered: `services.openspec` — rejected because openspec is not a daemon/service; HM convention reserves `services.*` for long-running processes

## Risks / Trade-offs

- **[Risk] Schema version mismatch**: If openspec CLI expects a different schema format than what's installed → Mitigation: Schema package version should be pinned alongside openspec version in the consumer's flake
- **[Risk] XDG_DATA_HOME override**: If a user sets a custom `XDG_DATA_HOME`, Home Manager's `xdg.dataFile` respects it, and so does openspec — no mismatch expected
- **[Trade-off] Nix-only**: This only helps Nix users. Acceptable as a starting point since the team uses Nix. Non-Nix methods can be added later without conflicting
