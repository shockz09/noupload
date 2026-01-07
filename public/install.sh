#!/bin/bash
set -e

# Configuration
BINARY_NAME="noupload"
PACKAGE_NAME="noupload"
INSTALL_DIR="/usr/local/bin"
NPM_REGISTRY="https://registry.npmjs.org/noupload/latest"

# Parse flags
FORCE_BINARY=false
for arg in "$@"; do
  case $arg in
    --binary)
      FORCE_BINARY=true
      shift
      ;;
  esac
done

# Detect package manager (priority: bun > pnpm > yarn > npm)
detect_package_manager() {
  if [ "$FORCE_BINARY" = true ]; then
    echo "none"
    return
  fi

  if command -v bun >/dev/null 2>&1; then echo "bun"; return; fi
  if command -v pnpm >/dev/null 2>&1; then echo "pnpm"; return; fi
  if command -v yarn >/dev/null 2>&1; then echo "yarn"; return; fi
  if command -v npm >/dev/null 2>&1; then echo "npm"; return; fi
  echo "none"
}

# Get latest version from npm registry
get_latest_version() {
  echo "🔍 Checking for updates..." >&2
  VERSION=$(curl -fsSL "$NPM_REGISTRY" 2>/dev/null | grep -oE '"version":"[^"]*"' | cut -d'"' -f4)
  echo "$VERSION"
}

# Get installed version
get_installed_version() {
  if command -v noupload >/dev/null 2>&1; then
    noupload --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo ""
  else
    echo ""
  fi
}

# Function: Install via package manager
install_via_pm() {
  local pm=$1
  local version=$2
  echo "📦 Detected $pm, installing via $pm..."
  echo "Downloading noupload@$version..."

  case $pm in
    bun)
      bun install -g noupload 2>&1
      ;;
    pnpm)
      pnpm install -g noupload 2>&1
      ;;
    yarn)
      yarn global add noupload 2>&1
      ;;
    npm)
      npm install -g noupload 2>&1
      ;;
  esac
}

# Function: Install via binary download
install_via_binary() {
  # Detect OS and Arch
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"

  # Map architecture names
  if [ "$ARCH" = "x86_64" ]; then
    ARCH="x64"
  elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    ARCH="arm64"
  else
    echo "❌ Unsupported architecture: $ARCH"
    exit 1
  fi

  # Construct asset name
  ASSET_NAME="${BINARY_NAME}-${OS}-${ARCH}"
  if [ "$OS" = "windows" ]; then
    ASSET_NAME="${ASSET_NAME}.exe"
  fi

  LATEST_URL="https://noupload.xyz/releases/${ASSET_NAME}"

  echo "⬇️  Downloading binary (60MB)..."
  echo "Downloading from $LATEST_URL..."

  # Setup install directory
  if [ ! -d "$INSTALL_DIR" ]; then
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"

    # Add to PATH if not present
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
      [ -f "$HOME/.bashrc" ] && echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$HOME/.bashrc"
      [ -f "$HOME/.zshrc" ] && echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$HOME/.zshrc"
    fi
  fi

  # Download
  TEMP_FILE="/tmp/${BINARY_NAME}"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$LATEST_URL" -o "$TEMP_FILE"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$TEMP_FILE" "$LATEST_URL"
  else
    echo "❌ Error: Need curl or wget to download."
    exit 1
  fi

  # Install
  chmod +x "$TEMP_FILE"

  if [ -w "$INSTALL_DIR" ]; then
    mv "$TEMP_FILE" "$INSTALL_DIR/$BINARY_NAME"
  else
    sudo mv "$TEMP_FILE" "$INSTALL_DIR/$BINARY_NAME"
  fi
}

# Main installation logic
main() {
  # Check versions
  INSTALLED_VERSION=$(get_installed_version)
  LATEST_VERSION=$(get_latest_version)

  # Handle version check failure
  if [ -z "$LATEST_VERSION" ]; then
    echo "⚠️  Could not fetch latest version, proceeding with install..."
    LATEST_VERSION="latest"
  fi

  # Check if already up to date
  if [ -n "$INSTALLED_VERSION" ] && [ "$INSTALLED_VERSION" = "$LATEST_VERSION" ]; then
    echo "✅ noupload is already installed and up to date (v$INSTALLED_VERSION)"
    exit 0
  elif [ -n "$INSTALLED_VERSION" ]; then
    echo "📦 Updating noupload from v$INSTALLED_VERSION to v$LATEST_VERSION..."
  fi

  # Detect package manager
  PM=$(detect_package_manager)

  if [ "$PM" != "none" ]; then
    # Try package manager first
    if install_via_pm "$PM" "$LATEST_VERSION"; then
      FINAL_VERSION=$(get_installed_version)
      echo "✅ Installed noupload v$FINAL_VERSION"
      echo "Run 'noupload setup' to install system dependencies."
      exit 0
    else
      # PM install failed, fallback to binary
      echo "⚠️  $pm install failed"
      echo "⬇️  Falling back to binary download (60MB)..."
      install_via_binary
      echo "✅ Installed noupload v$LATEST_VERSION"
      echo "Run 'noupload setup' to install system dependencies."
      exit 0
    fi
  else
    # No package manager found, use binary
    if [ "$FORCE_BINARY" = true ]; then
      echo "⬇️  Installing standalone binary (--binary flag)..."
    else
      echo "⬇️  No package manager found, installing standalone binary..."
    fi
    install_via_binary
    echo "✅ Installed noupload v$LATEST_VERSION"
    echo "Run 'noupload setup' to install system dependencies."
  fi
}

# Run main
main
