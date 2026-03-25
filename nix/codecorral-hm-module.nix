{ config, lib, pkgs, ... }:

let
  cfg = config.programs.codecorral;

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

      openspec = lib.mkOption {
        type = lib.types.submodule {
          options = {
            schemas = lib.mkOption {
              type = lib.types.listOf lib.types.str;
              default = [ ];
              description = "List of OpenSpec schema references to install";
            };
            schemas_path = lib.mkOption {
              type = lib.types.nullOr lib.types.str;
              default = null;
              description = "Relative path to project-local schemas";
            };
          };
        };
        default = { };
        description = "OpenSpec configuration for this project";
      };
    };
  };

  # Project names are used as profile names
  projectNames = lib.attrNames cfg.projects;

  # Collect all schema lists from all projects (union)
  allSchemas = lib.unique (lib.concatMap (proj: proj.openspec.schemas)
    (lib.attrValues cfg.projects));

  # Generate YAML config content with engine-own state only
  yamlFormat = pkgs.formats.yaml { };
  configData = {
    projects = lib.mapAttrs (name: proj:
      { inherit (proj) path workflows; agent_deck_profile = name; }
      // lib.optionalAttrs (proj.openspec.schemas_path != null) {
        openspec = { inherit (proj.openspec) schemas_path; };
      }
    ) cfg.projects;
  };

in
{
  meta.maintainers = [ ];

  options.programs.codecorral = {
    enable = lib.mkEnableOption "CodeCorral workflow engine";

    projects = lib.mkOption {
      type = lib.types.attrsOf projectType;
      default = { };
      description = "Project configurations for CodeCorral. Each project can declare claude-code settings (passed through to agentplot-kit profiles) and openspec schemas.";
    };
  };

  config = lib.mkIf cfg.enable {
    # Assert no duplicate profile names (project names are profile names)
    assertions = [
      {
        assertion = (lib.length projectNames) == (lib.length (lib.unique projectNames));
        message = "Duplicate profile names across CodeCorral projects: ${builtins.toJSON projectNames}";
      }
    ];

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

    # Delegate openspec schemas (union across all projects)
    programs.openspec = lib.mkIf (lib.hasAttrByPath [ "programs" "openspec" ] config) {
      enable = true;
      schemas = allSchemas;
    };
  };
}
