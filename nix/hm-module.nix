flake:

{ config, lib, pkgs, ... }:

let
  cfg = config.programs.openspec;

  defaultSchemaPackage = flake.packages.${pkgs.stdenv.hostPlatform.system}.openspec-schemas;

  schemaDir = "${cfg.schemaPackage}/share/openspec/schemas";

  availableSchemas = builtins.attrNames (builtins.readDir schemaDir);

  selectedSchemas =
    if cfg.schemas == [ ] then availableSchemas
    else cfg.schemas;

in
{
  meta.maintainers = [ ];

  options.programs.openspec = {
    enable = lib.mkEnableOption "OpenSpec schema management";

    schemas = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = "List of schema names to install. Empty list means all available schemas.";
    };

    schemaPackage = lib.mkOption {
      type = lib.types.package;
      default = defaultSchemaPackage;
      description = "The OpenSpec schemas package to install from.";
    };
  };

  config = lib.mkIf cfg.enable {
    xdg.dataFile = lib.listToAttrs (map (name: {
      name = "openspec/schemas/${name}";
      value = {
        source = "${schemaDir}/${name}";
        recursive = true;
      };
    }) selectedSchemas);
  };
}
