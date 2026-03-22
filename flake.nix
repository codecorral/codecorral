{
  description = "CodeCorral – workflow engine and OpenSpec schema distribution";

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

        packages.codecorral = pkgs.buildNpmPackage {
          pname = "codecorral";
          version = "0.1.0";
          src = ./.;
          npmDepsHash = "";
          dontNpmBuild = true;
          buildPhase = ''
            npx tsc
          '';
          installPhase = ''
            mkdir -p $out/bin $out/lib/codecorral
            cp -r dist/* $out/lib/codecorral/
            cp -r node_modules $out/lib/codecorral/
            cat > $out/bin/codecorral <<EOF
            #!/usr/bin/env node
            require('$out/lib/codecorral/cli/index.js');
            EOF
            chmod +x $out/bin/codecorral
          '';
        };
      }
    ) // {
      homeManagerModules.openspec = import ./nix/hm-module.nix self;
      homeManagerModules.codecorral = import ./nix/codecorral-hm-module.nix;
    };
}
