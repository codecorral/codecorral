flake:

{ config, lib, pkgs, ... }:

let
  cfg = config.programs.codecorral;

  defaultSchemaPackage = flake.packages.${pkgs.stdenv.hostPlatform.system}.openspec-schemas;

  schemaDir = "${cfg.schema_package}/share/openspec/schemas";

  availableSchemas = builtins.attrNames (builtins.readDir schemaDir);

  selectedSchemas =
    if cfg.schemas == [ ] then availableSchemas
    else cfg.schemas;

  projectType = lib.types.submodule {
    options = {
      path = lib.mkOption {
        type = lib.types.str;
        description = "Absolute path to the project directory";
      };

      workflows = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
        description = "List of workflow definitions to enable for this project";
      };

      claude_code = lib.mkOption {
        type = lib.types.attrsOf lib.types.anything;
        default = { };
        description = "Full pass-through to programs.claude-code.profiles.<name>. Accepts any options the agentplot-kit claude-code module supports (settings, agents, rules, skills, etc.).";
      };
    };
  };

  # Generate YAML config content with engine-own state only
  yamlFormat = pkgs.formats.yaml { };
  configData = {
    projects = lib.mapAttrs (name: proj:
      { inherit (proj) path workflows; agent_deck_profile = name; }
    ) cfg.projects;
  };

in
{
  meta.maintainers = [ ];

  options.programs.codecorral = {
    enable = lib.mkEnableOption "CodeCorral workflow engine";

    schemas = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = "List of OpenSpec schema names to install. Empty list means all available schemas.";
    };

    schema_package = lib.mkOption {
      type = lib.types.package;
      default = defaultSchemaPackage;
      description = "The OpenSpec schemas package to install from.";
    };

    projects = lib.mkOption {
      type = lib.types.attrsOf projectType;
      default = { };
      description = "Project configurations for CodeCorral. Each project can declare claude-code settings (passed through to agentplot-kit profiles).";
    };
  };

  config = lib.mkIf cfg.enable {
    # Install OpenSpec schemas to XDG data directory
    xdg.dataFile = lib.listToAttrs (map (name: {
      name = "openspec/schemas/${name}";
      value = {
        source = "${schemaDir}/${name}";
        recursive = true;
      };
    }) selectedSchemas);

    # Generate ~/.codecorral/config.yaml with engine-own state only
    home.file.".codecorral/config.yaml".source =
      yamlFormat.generate "codecorral-config.yaml" configData;

    # Delegate per-project agent-deck profile (claude.config_dir convention only)
    programs.agent-deck = lib.mkIf (lib.hasAttrByPath [ "programs" "agent-deck" ] config) {
      profiles = lib.mapAttrs (name: _proj: {
        claude.configDir = lib.mkDefault ".claude-${name}";
      }) cfg.projects;
    };

    # Delegate per-project claude-code settings (full pass-through via agentplot-kit)
    programs.claude-code = lib.mkIf (lib.hasAttrByPath [ "programs" "claude-code" "profiles" ] config) {
      profiles = lib.mapAttrs (name: proj:
        lib.mkMerge [
          { configDir = lib.mkDefault ".claude-${name}"; }
          proj.claude_code
        ]
      ) (lib.filterAttrs (_: proj: proj.claude_code != { }) cfg.projects);
    };
  };
}
