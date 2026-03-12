## Why

Custom OpenSpec schemas (like `intent`) are project-local today. Other projects that want the same schema must manually copy the directory. We need a declarative, reproducible way to distribute schemas to any project on a Nix-managed system using Home Manager.

## What Changes

- Add a Nix flake that exports codecorral's custom schemas as a package
- Add a Home Manager module that installs schemas to `~/.local/share/openspec/schemas/` (the user-tier override path openspec already resolves)
- Schemas become available globally without vendoring into each project

## Capabilities

### New Capabilities
- `nix-schema-package`: Nix derivation that packages custom OpenSpec schemas for distribution
- `home-manager-module`: Home Manager module that declaratively manages user-level schema installation

### Modified Capabilities

None.

## Impact

- **Nix flake**: New `flake.nix` at repo root (or schemas-specific flake) exporting the schema package
- **Home Manager**: New module consumers add to their Home Manager config
- **openspec**: No changes needed — leverages existing user-tier schema resolution at `~/.local/share/openspec/schemas/`
- **Existing projects**: No impact — project-local schemas still take precedence over user-level
