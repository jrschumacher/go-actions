#!/usr/bin/env bash
set -euo pipefail

action_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
mkdir -p "$test_dir/mock-bin" "$test_dir/gobin"

cat > "$test_dir/mock-bin/curl" <<'MOCK_CURL'
#!/usr/bin/env bash
case "$*" in
  *releases/latest*) printf '{"tag_name":"v2.15.0"}\n' ;;
  *install.sh*) cat <<'MOCK_INSTALLER'
#!/bin/sh
cat > "$GOBIN/golangci-lint" <<'MOCK_BINARY'
#!/bin/sh
echo 'golangci-lint has version 2.15.0 built with go1.22.12'
MOCK_BINARY
chmod +x "$GOBIN/golangci-lint"
if [ "$MOCK_INSTALLER_MODE" = fail ]; then
  echo 'hash_sha256_verify checksum did not verify' >&2
  exit 1
fi
MOCK_INSTALLER
    ;;
  *) exit 99 ;;
esac
MOCK_CURL

cat > "$test_dir/mock-bin/go" <<'MOCK_GO'
#!/usr/bin/env bash
case "$1" in
  version) echo 'go version go1.22.12 linux/amd64' ;;
  install)
    [[ "$2" == 'github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.15.0' ]]
    [[ ! -e "$GOBIN/golangci-lint" ]] || { echo 'partial binary was not removed' >&2; exit 1; }
    echo "$2" >> "$MOCK_GO_INSTALL_LOG"
    cat > "$GOBIN/golangci-lint" <<'MOCK_BINARY'
#!/bin/sh
echo 'golangci-lint has version 2.15.0 built with go1.22.12'
MOCK_BINARY
    chmod +x "$GOBIN/golangci-lint"
    ;;
  *) exit 99 ;;
esac
MOCK_GO
chmod +x "$test_dir/mock-bin/curl" "$test_dir/mock-bin/go"

export PATH="$test_dir/mock-bin:$PATH"
export GOBIN="$test_dir/gobin"
export MOCK_GO_INSTALL_LOG="$test_dir/go-install.log"

export MOCK_INSTALLER_MODE=fail
bash "$action_dir/install-golangci-lint.sh"
[[ $(cat "$MOCK_GO_INSTALL_LOG") == 'github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.15.0' ]]

rm -f "$GOBIN/golangci-lint" "$MOCK_GO_INSTALL_LOG"
export MOCK_INSTALLER_MODE=success
bash "$action_dir/install-golangci-lint.sh"
[[ ! -e "$MOCK_GO_INSTALL_LOG" ]]
[[ -x "$GOBIN/golangci-lint" ]]

echo 'golangci-lint install cases passed'
