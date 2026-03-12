# Capability: nix-schema-package

## Purpose
Nix package derivation that builds and exports custom OpenSpec schemas for distribution via the Nix ecosystem.

## Requirements

### Requirement: Schema package derivation
The flake SHALL export a Nix package `openspec-schemas` that installs all custom schemas from `openspec/schemas/` into `$out/share/openspec/schemas/`.

#### Scenario: Package builds successfully
- **WHEN** a user runs `nix build .#openspec-schemas`
- **THEN** the result SHALL contain `share/openspec/schemas/intent/schema.yaml` and all template files

#### Scenario: Package includes only custom schemas
- **WHEN** the package is built
- **THEN** it SHALL include only project-defined schemas (e.g., `intent`), not built-in schemas like `spec-driven`

### Requirement: Schema package structure matches openspec resolution
The package output structure SHALL match the directory layout openspec expects at `~/.local/share/openspec/schemas/`, so schemas can be symlinked directly without restructuring.

#### Scenario: Directory structure is resolution-compatible
- **WHEN** the package output `share/openspec/schemas/<name>/` is symlinked to `~/.local/share/openspec/schemas/<name>/`
- **THEN** `openspec schema which <name>` SHALL resolve the schema from the user override tier

### Requirement: Flake exports schema package
The flake SHALL export the schema package under `packages.<system>.openspec-schemas` for all supported systems (x86_64-linux, aarch64-linux, x86_64-darwin, aarch64-darwin).

#### Scenario: Cross-platform availability
- **WHEN** a consumer references `codecorral.packages.${system}.openspec-schemas`
- **THEN** the package SHALL be available on Linux and macOS for both x86_64 and aarch64
