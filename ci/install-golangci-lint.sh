#!/usr/bin/env bash
set -eo pipefail

go_version=$(go version | awk '{print $3}' | sed 's/go//')
go_minor=$(echo "$go_version" | cut -d. -f2)

# Fetch the latest golangci-lint version from GitHub.
version=$(curl -sS https://api.github.com/repos/golangci/golangci-lint/releases/latest | jq -r '.tag_name // empty')
if [ -z "$version" ] || [ "$version" = "null" ]; then
  version="v2.11.4"
  echo "⚠️ Failed to fetch latest version, falling back to $version"
fi
echo "🔍 Using golangci-lint $version for Go $go_version"

# Install to job-scoped GOBIN so one job cannot overwrite another's binary.
echo "Installing golangci-lint $version to $GOBIN..."
if ! curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b "$GOBIN" "$version"; then
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
