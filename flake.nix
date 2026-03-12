{
  description = "Silo - Nostr Remote Signer (browser extension)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSystem = nixpkgs.lib.genAttrs supportedSystems;
      pkgs = forEachSystem (system: nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forEachSystem (system:
        let
          p = pkgs.${system};
        in
        {
          default = p.mkShell {
            name = "silo";
            buildInputs = [
              p.nodejs_22
              p.nodePackages.npm
            ];
            shellHook = ''
              echo "Silo dev shell — run 'npm install' then 'npm run build' if needed."
            '';
          };
        });

      packages = forEachSystem (system:
        let
          p = pkgs.${system};
          node = p.nodejs_22;
        in
        {
          default = p.stdenv.mkDerivation {
            name = "silo-extension";
            src = self;
            dontConfigure = true;

            nativeBuildInputs = [ node p.nodePackages.npm ];

            buildPhase = ''
              export HOME=$TMPDIR
              npm ci 2>/dev/null || npm install
              npm run build 2>/dev/null || true
            '';

            installPhase = ''
              mkdir -p $out
              cp -r background content popup icons manifest.json $out/
              [ -d dist ] && cp -r dist $out/ || true
              [ -f README.md ] && cp README.md $out/ || true
            '';
          };
        });
    };
}
