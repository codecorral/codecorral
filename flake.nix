{
  description = "CodeCorral – OpenSpec schema distribution";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.openspec-schemas = pkgs.runCommand "openspec-schemas" { } ''
          mkdir -p $out/share/openspec/schemas
          cp -r ${./openspec/schemas}/* $out/share/openspec/schemas/
        '';
      }
    ) // {
      homeManagerModules.openspec = import ./nix/hm-module.nix self;
    };
}
