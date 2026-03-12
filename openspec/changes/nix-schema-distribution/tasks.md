## 1. Flake Setup

- [ ] 1.1 Create `flake.nix` at repo root with basic flake structure and `flake-utils` input
- [ ] 1.2 Define the `openspec-schemas` package derivation that copies `openspec/schemas/*` to `$out/share/openspec/schemas/`
- [ ] 1.3 Export `packages.<system>.openspec-schemas` for all four supported systems (x86_64-linux, aarch64-linux, x86_64-darwin, aarch64-darwin)

## 2. Home Manager Module

- [ ] 2.1 Create `nix/hm-module.nix` with module option `services.openspec.enable` (bool, default false)
- [ ] 2.2 Add option `services.openspec.schemas` (list of strings, default all available schemas)
- [ ] 2.3 Implement `xdg.dataFile` entries that symlink selected schemas from the package to `openspec/schemas/<name>`
- [ ] 2.4 Export the module as `homeManagerModules.openspec` in `flake.nix`

## 3. Validation

- [ ] 3.1 Run `nix build .#openspec-schemas` and verify the output contains `share/openspec/schemas/intent/schema.yaml` with templates
- [ ] 3.2 Add the Home Manager module to a test config, run `home-manager switch`, and verify `~/.local/share/openspec/schemas/intent/schema.yaml` is a symlink to the Nix store
- [ ] 3.3 Run `openspec schema which intent` from a project without a local intent schema and verify it resolves from `user` tier
- [ ] 3.4 Verify project-local schemas still take precedence over user-level schemas
