flake:

{ config, lib, pkgs, ... }:

let
  cfg = config.programs.codecorral;
  system = pkgs.stdenv.hostPlatform.system;

  defaultSchemaPackage = flake.packages.${system}.openspec-schemas;
  defaultDeckPackage = flake.packages.${system}.codecorral-deck;
  shufflePackage = flake.inputs.shuffle.packages.${system}.default;

  schemaDir = "${cfg.schema_package}/share/openspec/schemas";

  availableSchemas = builtins.attrNames (builtins.readDir schemaDir);

  selectedSchemas =
    if cfg.schemas == [ ] then availableSchemas
    else cfg.schemas;

  conductorOverrideType = lib.types.submodule {
    options = {
      claude_md = lib.mkOption {
        type = lib.types.nullOr lib.types.path;
        default = null;
        description = "Override the conductor's claude_md (agent instructions). Null uses the bundled default.";
      };
      policy_md = lib.mkOption {
        type = lib.types.nullOr lib.types.path;
        default = null;
        description = "Override the conductor's policy_md (approval/routing rules). Null uses the bundled default.";
      };
    };
  };

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

      conductors = lib.mkOption {
        type = lib.types.attrsOf conductorOverrideType;
        default = { };
        description = "Per-conductor overrides for this project. Keys are conductor names (e.g., 'foreman'). Overrides claude_md and/or policy_md in the deck YAML.";
      };
    };
  };

  # Build a per-project deck derivation with conductor overrides applied
  projectDeck = name: proj:
    let
      hasOverrides = proj.conductors != { };
      overrideCommands = lib.concatStringsSep "\n" (lib.mapAttrsToList (conductorName: overrides:
        let
          claudeMdCmd = lib.optionalString (overrides.claude_md != null)
            "cp ${overrides.claude_md} $out/conductors/${conductorName}.md";
          policyMdCmd = lib.optionalString (overrides.policy_md != null)
            "cp ${overrides.policy_md} $out/conductors/${conductorName}-policy.md";
        in
        ''
          ${claudeMdCmd}
          ${policyMdCmd}
        ''
      ) proj.conductors);
    in
    if hasOverrides then
      pkgs.runCommand "codecorral-deck-${name}" { } ''
        mkdir -p $out/conductors
        cp -r ${defaultDeckPackage}/* $out/
        chmod -R u+w $out
        ${overrideCommands}
      ''
    else
      defaultDeckPackage;

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
      description = "Project configurations for CodeCorral. Each project can declare claude-code settings, conductor overrides, and workflow assignments.";
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

    # Run shuffle deal for each project on home-manager switch
    home.activation.codecorral-deck = lib.mkIf (cfg.projects != { })
      (lib.hm.dag.entryAfter [ "writeBoundary" ] (
        lib.concatStringsSep "\n" (lib.mapAttrsToList (name: proj:
          let deck = projectDeck name proj;
          in ''
            $DRY_RUN_CMD ${shufflePackage}/bin/shuffle deal \
              --profile "${name}" \
              "${deck}/codecorral.deck.yaml" \
              || $VERBOSE_ECHO "warning: shuffle deal failed for project ${name}"
          ''
        ) cfg.projects)
      ));
  };
}
