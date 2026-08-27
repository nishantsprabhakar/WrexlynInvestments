#!/usr/bin/env bash
# Wrexlyn for Investments — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
# Unauthorized copying, modification, or distribution is prohibited. See LICENSE for details.
#
# Linux + macOS installer: copies this project to a per-user install location,
# adds a `wrexlyn-investments` command to ~/.local/bin, and registers a
# launcher (a desktop entry on Linux, a minimal double-clickable .app bundle
# in ~/Applications on macOS — no admin rights, no code signing, matching the
# Windows Inno Setup installer's own "per-user, PrivilegesRequired=lowest"
# posture rather than needing a signed/notarized .pkg). Run it from inside
# the project directory: ./install.sh
set -euo pipefail

IS_MACOS=0
if [ "$(uname -s)" = "Darwin" ]; then
  IS_MACOS=1
fi

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$IS_MACOS" = "1" ]; then
  INSTALL_DIR="${WREXLYN_INVESTMENTS_INSTALL_DIR:-$HOME/Library/Application Support/Wrexlyn Investments}"
  APPS_DIR="$HOME/Applications"
else
  INSTALL_DIR="${WREXLYN_INVESTMENTS_INSTALL_DIR:-$HOME/.local/share/wrexlyn-investments}"
  DESKTOP_DIR="$HOME/.local/share/applications"
fi
BIN_DIR="$HOME/.local/bin"

echo "Installing Wrexlyn for Investments to: $INSTALL_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Note: Node.js 18+ wasn't found on this system. It's needed to run this app — install it"
  echo "before first launch, e.g.:"
  if [ "$IS_MACOS" = "1" ]; then
    echo "  Homebrew: brew install node"
  else
    echo "  Debian/Ubuntu: sudo apt install nodejs npm"
    echo "  Fedora:        sudo dnf install nodejs npm"
    echo "  Arch:          sudo pacman -S nodejs npm"
  fi
  echo "  Or: https://nodejs.org"
  echo ""
fi

if [ "$IS_MACOS" = "1" ]; then
  mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$APPS_DIR"
else
  mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$DESKTOP_DIR"
fi

if [ -d "$SOURCE_DIR/.git" ] && command -v git >/dev/null 2>&1; then
  # Copy exactly what git tracks (respects .gitignore) rather than a hand-maintained
  # blocklist, so no stray build artifact or scratch file ships into the install.
  # `installer/` is tracked but Windows-only packaging, so it's excluded explicitly.
  if command -v rsync >/dev/null 2>&1; then
    (cd "$SOURCE_DIR" && git ls-files -z -- . ':!installer') |
      rsync -a --from0 --files-from=- "$SOURCE_DIR/" "$INSTALL_DIR/"
  else
    (cd "$SOURCE_DIR" && git ls-files -z -- . ':!installer') |
      tar -C "$SOURCE_DIR" --null -T - -cf - | tar -C "$INSTALL_DIR" -xf -
  fi
else
  echo "Warning: $SOURCE_DIR isn't a git checkout -- falling back to a name-based exclude" >&2
  echo "list, which (unlike a git-tracked-files copy) can't tell source files from stray" >&2
  echo "untracked ones that happen to be sitting in this directory." >&2
  EXCLUDES=(--exclude node_modules --exclude dist --exclude data --exclude '*.log' --exclude installer)
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "${EXCLUDES[@]}" "$SOURCE_DIR/" "$INSTALL_DIR/"
  else
    find "$SOURCE_DIR" -mindepth 1 -maxdepth 1 \
      ! -name node_modules ! -name dist ! -name data ! -name '*.log' ! -name installer \
      -exec cp -r {} "$INSTALL_DIR/" \;
  fi
fi

chmod +x \
  "$INSTALL_DIR/Start Wrexlyn Investments.sh" \
  "$INSTALL_DIR/scripts/launch.sh" \
  "$INSTALL_DIR/scripts/open-browser-when-ready.sh"

cat > "$BIN_DIR/wrexlyn-investments" <<EOF
#!/usr/bin/env bash
exec "$INSTALL_DIR/Start Wrexlyn Investments.sh" "\$@"
EOF
chmod +x "$BIN_DIR/wrexlyn-investments"

if [ "$IS_MACOS" = "1" ]; then
  # A minimal, unsigned .app bundle — no Apple Developer account or notarization needed,
  # matching the Windows installer's own per-user, no-admin posture. Its one job is to open
  # Terminal.app and run the real launcher there, so first-run npm install/build output is
  # visible (the same reason the Linux .desktop entry below sets Terminal=true).
  APP_DIR="$APPS_DIR/Wrexlyn Investments.app"
  mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
  if [ -f "$SOURCE_DIR/installer/macos/wrexlyn-investments.icns" ]; then
    cp "$SOURCE_DIR/installer/macos/wrexlyn-investments.icns" "$APP_DIR/Contents/Resources/wrexlyn-investments.icns"
  fi

  cat > "$APP_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>WrexlynInvestments</string>
  <key>CFBundleIconFile</key>
  <string>wrexlyn-investments.icns</string>
  <key>CFBundleIdentifier</key>
  <string>com.nishantprabhakar.wrexlyn-investments</string>
  <key>CFBundleName</key>
  <string>Wrexlyn Investments</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
</dict>
</plist>
PLIST

  cat > "$APP_DIR/Contents/MacOS/WrexlynInvestments" <<LAUNCHER
#!/usr/bin/env bash
open -a Terminal "$INSTALL_DIR/Start Wrexlyn Investments.sh"
LAUNCHER
  chmod +x "$APP_DIR/Contents/MacOS/WrexlynInvestments"
else
  cat > "$DESKTOP_DIR/wrexlyn-investments.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Wrexlyn for Investments
Comment=PE/VC deal intelligence platform
Exec=$INSTALL_DIR/Start Wrexlyn Investments.sh
Icon=$INSTALL_DIR/public/icon-512.png
Terminal=true
Categories=Office;Finance;
EOF
  chmod +x "$DESKTOP_DIR/wrexlyn-investments.desktop"
fi

echo ""
echo "Installed. Launch it with any of:"
echo "  wrexlyn-investments"
echo "  $INSTALL_DIR/Start Wrexlyn Investments.sh"
if [ "$IS_MACOS" = "1" ]; then
  echo "  or find \"Wrexlyn Investments\" in ~/Applications (double-click opens Terminal and starts it)"
else
  echo "  or find \"Wrexlyn for Investments\" in your desktop's application menu"
fi
echo ""

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo "Note: $BIN_DIR isn't on your PATH yet, so the \`wrexlyn-investments\` command above won't be found until you add it."
    echo "Add this line to your ~/.bashrc or ~/.zshrc, then restart your terminal:"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

echo ""
if [ "$IS_MACOS" = "1" ]; then
  echo "To uninstall later: rm -rf \"$INSTALL_DIR\" \"$BIN_DIR/wrexlyn-investments\" \"$APPS_DIR/Wrexlyn Investments.app\""
else
  echo "To uninstall later: rm -rf \"$INSTALL_DIR\" \"$BIN_DIR/wrexlyn-investments\" \"$DESKTOP_DIR/wrexlyn-investments.desktop\""
fi
