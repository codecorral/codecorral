{
  description = "CodeCorral – workflow engine and OpenSpec schema distribution";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    shuffle.url = "github:codecorral/shuffle";
  };

  outputs = { self, nixpkgs, flake-utils, shuffle }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.openspec-schemas = pkgs.runCommand "openspec-schemas" { } ''
          mkdir -p $out/share/openspec/schemas
          cp -r ${./openspec/schemas}/* $out/share/openspec/schemas/
        '';

        packages.codecorral-deck = pkgs.runCommand "codecorral-deck" { } ''
          mkdir -p $out
          cp -r ${./decks}/* $out/
        '';

        # Build the codecorral CLI using Bun for TypeScript compilation.
        # Falls back to a simple stdenv derivation since there is no
        # buildBunPackage in nixpkgs yet (nixpkgs#255890).
        # Known caveats: Bun.build() compile mode may produce 0-byte binaries
        # in Nix sandbox (oven-sh/bun#24645); AVX issues on macOS/Rosetta.
        packages.codecorral = pkgs.stdenv.mkDerivation {
          pname = "codecorral";
          version = "0.1.0";
          src = ./.;

          nativeBuildInputs = [ pkgs.bun pkgs.nodejs ];

          buildPhase = ''
            export HOME=$TMPDIR
            bun install --frozen-lockfile
            bun run build
          '';

          installPhase = ''
            mkdir -p $out/bin $out/lib/codecorral
            cp -r dist/* $out/lib/codecorral/
            cp -r node_modules $out/lib/codecorral/

            cat > $out/bin/codecorral <<WRAPPER
            #!/usr/bin/env node
            require('$out/lib/codecorral/cli/index.js');
            WRAPPER
            chmod +x $out/bin/codecorral
          '';
        };

        checks = {
          openspec-schemas = self.packages.${system}.openspec-schemas;
          codecorral-hm-module = pkgs.runCommand "check-codecorral-hm-module" { } ''
            # Validate that the HM module file parses as valid Nix
            ${pkgs.nix}/bin/nix-instantiate --parse ${./nix/codecorral-hm-module.nix} > /dev/null
            touch $out
          '';
        };
      }
    ) // {
      homeManagerModules.codecorral = import ./nix/codecorral-hm-module.nix self;

      # Backwards-compatible alias — programs.openspec forwards to programs.codecorral
      homeManagerModules.openspec = { lib, ... }: {
        imports = [
          (import ./nix/codecorral-hm-module.nix self)
          (lib.mkRenamedOptionModule [ "programs" "openspec" "enable" ] [ "programs" "codecorral" "enable" ])
          (lib.mkRenamedOptionModule [ "programs" "openspec" "schemas" ] [ "programs" "codecorral" "schemas" ])
          (lib.mkRenamedOptionModule [ "programs" "openspec" "schemaPackage" ] [ "programs" "codecorral" "schema_package" ])
        ];
      };
    };
}
