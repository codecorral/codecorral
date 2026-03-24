## MODIFIED Requirements

### Requirement: codecorral projects command
The CLI SHALL provide `codecorral projects` to enumerate all configured projects from `~/.codecorral/config.yaml` with their paths, enabled workflows, and status (whether the path exists and is accessible).

#### Scenario: List configured projects
- **WHEN** the user runs `codecorral projects` and config.yaml defines two projects
- **THEN** the CLI displays each project name, path, enabled workflows, and whether the path exists on disk

#### Scenario: No config file
- **WHEN** the user runs `codecorral projects` and `~/.codecorral/config.yaml` does not exist
- **THEN** the CLI displays "No configuration found. Create ~/.codecorral/config.yaml or use Nix Home Manager module."

## REMOVED Requirements

### Requirement: codecorral workspaces command
**Reason**: Renamed to `codecorral projects` to avoid terminology collision with cmux workspaces (vertical tabs).
**Migration**: Use `codecorral projects` instead of `codecorral workspaces`.
