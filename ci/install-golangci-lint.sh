#!/usr/bin/env bash
set -eo pipefail

go_version=$(go version | awk '{print $3}' | sed 's/go//')
go_minor=$(echo "$go_version" | cut -d. -f2)

# A pinned default keeps lint results stable and the install reproducible.
# GOLANGCI_LINT_VERSION (the golangci-lint-version input) overrides it;
# "latest" or "auto" asks GitHub for the newest release.
default_version="v2.15.0"
version="${GOLANGCI_LINT_VERSION:-$default_version}"
if [ "$version" = "latest" ] || [ "$version" = "auto" ]; then
  version=$(curl -sS https://api.github.com/repos/golangci/golangci-lint/releases/latest | jq -r '.tag_name // empty' || true)
  case "$version" in
    v[0-9]*) ;;
    *)
      echo "⚠️ Failed to read the latest version, falling back to $default_version"
      version="$default_version"
      ;;
  esac
fi
case "$version" in
  v[0-9]*) ;;
  *) echo "::error::golangci-lint version must look like v2.15.0, got '$version'"; exit 1 ;;
esac
echo "🔍 Using golangci-lint $version for Go $go_version"

# The installer comes from the same tag as the version it installs, not master.
# Install to job-scoped GOBIN so one job cannot overwrite another's binary.
echo "Installing golangci-lint $version to $GOBIN..."
if ! curl -sSfL "https://raw.githubusercontent.com/golangci/golangci-lint/$version/install.sh" | sh -s -- -b "$GOBIN" "$version"; then
  echo "::warning::Verified golangci-lint binary install failed; building from Go modules instead"
  rm -f "$GOBIN/golangci-lint"
  go install "github.com/golangci/golangci-lint/v2/cmd/golangci-lint@$version"
fi
export PATH="$GOBIN:$PATH"

# The prebuilt binary must use a Go minor version at least as new as the project.
lint_go_minor=$(golangci-lint version 2>/dev/null | grep -o 'built with go[0-9.]*' | sed 's/built with go//' | cut -d. -f2)
if [ -n "$lint_go_minor" ] && [ "$go_minor" -gt "$lint_go_minor" ]; then
  echo "⚠️ Prebuilt golangci-lint was built with older Go (minor $lint_go_minor) than project (minor $go_minor)"
  echo "📦 Rebuilding from source with current Go toolchain..."
  go install "github.com/golangci/golangci-lint/v2/cmd/golangci-lint@$version"
fi

golangci-lint version
