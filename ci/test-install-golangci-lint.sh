#!/usr/bin/env bash
set -euo pipefail

action_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
mkdir -p "$test_dir/mock-bin" "$test_dir/gobin"

cat > "$test_dir/mock-bin/curl" <<'MOCK_CURL'
#!/usr/bin/env bash
echo "$*" >> "$MOCK_CURL_LOG"
case "$*" in
  # GitHub's API now answers on one line; the reactions block ends in "eyes".
  *releases/latest*) printf '{"url":"x","tag_name":"v2.15.0","reactions":{"+1":1,"eyes":0}}' ;;
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
export MOCK_CURL_LOG="$test_dir/curl.log"

export MOCK_INSTALLER_MODE=fail
bash "$action_dir/install-golangci-lint.sh"
[[ $(cat "$MOCK_GO_INSTALL_LOG") == 'github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.15.0' ]]

rm -f "$GOBIN/golangci-lint" "$MOCK_GO_INSTALL_LOG"
export MOCK_INSTALLER_MODE=success
bash "$action_dir/install-golangci-lint.sh"
[[ ! -e "$MOCK_GO_INSTALL_LOG" ]]
[[ -x "$GOBIN/golangci-lint" ]]

echo 'golangci-lint install cases passed'

# The pinned default: no call to the releases API, and the installer comes
# from the version's tag rather than master.
rm -f "$GOBIN/golangci-lint" "$MOCK_CURL_LOG"
unset GOLANGCI_LINT_VERSION
bash "$action_dir/install-golangci-lint.sh"
! grep -q 'releases/latest' "$MOCK_CURL_LOG"
grep -q 'golangci-lint/v2.15.0/install.sh' "$MOCK_CURL_LOG"
! grep -q '/master/' "$MOCK_CURL_LOG"

# "latest" reads the tag from one-line JSON (where a grep/sed parse found "eyes").
rm -f "$GOBIN/golangci-lint" "$MOCK_CURL_LOG"
out=$(GOLANGCI_LINT_VERSION=latest bash "$action_dir/install-golangci-lint.sh")
grep -q 'Using golangci-lint v2.15.0' <<<"$out"
grep -q 'releases/latest' "$MOCK_CURL_LOG"

# A version that isn't a tag is refused before anything is downloaded.
rm -f "$GOBIN/golangci-lint" "$MOCK_CURL_LOG"
if GOLANGCI_LINT_VERSION=eyes bash "$action_dir/install-golangci-lint.sh" >/dev/null 2>&1; then
  echo 'a version that is not a tag was accepted' >&2
  exit 1
fi
[[ ! -s "$MOCK_CURL_LOG" ]]

echo "golangci-lint version pinning cases passed"
