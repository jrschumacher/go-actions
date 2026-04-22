# Prebuilt go-actions CLI Binaries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-job source-builds of the `go-actions` CLI with a download of the prebuilt binary published by GoReleaser, with transparent fallback to source-build.

**Architecture:** A `VERSION` file at the repo root is updated by release-please on each release (via `extra-files`). The `ci/action.yaml` download step reads that file, constructs the GoReleaser archive URL, fetches and extracts it, and exports the install path via `$GITHUB_ENV`. If any step fails, the step falls back to the existing `go build` path.

**Tech Stack:** GitHub Composite Action (bash), GoReleaser (already configured), release-please (already configured).

**Spec:** `docs/superpowers/specs/2026-04-21-prebuilt-cli-binaries-design.md`

---

## File Map

- **Create:** `VERSION` — plain-text file containing the current release version (e.g., `3.2.0\n`). Updated by release-please on each release.
- **Modify:** `release-please-config.json` — add `"extra-files": ["VERSION"]` to the `.` package config.
- **Modify:** `ci/action.yaml:94-102` — replace `Build go-actions CLI` step with `Install go-actions CLI` (download-or-build).
- **Modify:** `ci/action.yaml:172` — swap hard-coded `/tmp/go-actions` for `"$GO_ACTIONS_BIN"`.
- **Modify:** `.github/workflows/ci.yaml` — add two smoke-test jobs (fast-path and fallback).
- **Modify:** `README.md` — add "Platform support" section.

---

## Task 1: Seed VERSION file and configure release-please

**Files:**
- Create: `VERSION`
- Modify: `release-please-config.json`

- [ ] **Step 1: Create `VERSION` with the current release version**

Current release is `3.2.0` (latest tag `go-actions-v3.2.0`). File content must be the bare version number with a trailing newline:

```
3.2.0
```

Run:

```bash
printf '3.2.0\n' > VERSION
```

- [ ] **Step 2: Update `release-please-config.json` to manage VERSION**

Open `release-please-config.json`. The current `.` package block is:

```json
"packages": {
  ".": {
    "release-type": "simple",
    "component": "go-actions",
    "package-name": "go-actions"
  }
}
```

Change it to:

```json
"packages": {
  ".": {
    "release-type": "simple",
    "component": "go-actions",
    "package-name": "go-actions",
    "extra-files": [
      "VERSION"
    ]
  }
}
```

**Note on `extra-files` behavior:** release-please with a plain string entry (`"VERSION"`) finds the current version substring (`3.2.0`) in the file and replaces it with the next version. Because `VERSION` contains only the version, this works out of the box. If release-please complains at release-PR time that the pattern is ambiguous, switch to the explicit form:

```json
"extra-files": [
  { "type": "generic", "path": "VERSION" }
]
```

and add a comment marker line to `VERSION`:

```
3.2.0 # x-release-please-version
```

(The action's download step already trims whitespace and can be extended with a simple `awk '{print $1}'` to strip the marker if this fallback is needed.)

- [ ] **Step 3: Verify the JSON is valid**

Run:

```bash
python3 -c "import json; json.load(open('release-please-config.json'))" && echo "OK"
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add VERSION release-please-config.json
git commit -m "feat: add VERSION file managed by release-please"
```

---

## Task 2: Replace build step with download-or-build in `ci/action.yaml`

**Files:**
- Modify: `ci/action.yaml` (replace lines 94-102; update line 172)

- [ ] **Step 1: Replace the `Build go-actions CLI` step**

Open `ci/action.yaml`. Find the existing step at lines 94-102:

```yaml
    - name: Build go-actions CLI
      shell: bash
      env:
        ACTION_PATH: ${{ github.action_path }}
      run: |
        echo "Building go-actions CLI..."
        cd "$ACTION_PATH/../cli"
        go build -o /tmp/go-actions ./cmd/go-actions
        echo "✅ CLI built successfully"
```

Replace it with:

```yaml
    - name: Install go-actions CLI
      shell: bash
      env:
        ACTION_PATH: ${{ github.action_path }}
      run: |
        set -e

        bin_name="go-actions"
        if [ "$RUNNER_OS" = "Windows" ]; then
          bin_name="go-actions.exe"
        fi
        install_path="$RUNNER_TEMP/$bin_name"

        os=$(echo "$RUNNER_OS" | tr '[:upper:]' '[:lower:]')
        case "$RUNNER_ARCH" in
          X64) arch=amd64 ;;
          ARM64) arch=arm64 ;;
          *) arch="" ;;
        esac

        version_file="$ACTION_PATH/../VERSION"
        if [ -n "$arch" ] && [ -f "$version_file" ]; then
          version=$(tr -d '[:space:]' < "$version_file")
          ext="tar.gz"
          if [ "$os" = "windows" ]; then
            ext="zip"
          fi
          url="https://github.com/jrschumacher/go-actions/releases/download/go-actions-v${version}/go-actions_${version}_${os}_${arch}.${ext}"
          tmp=$(mktemp -d)
          echo "Downloading prebuilt go-actions v${version} (${os}/${arch}) from ${url}"
          if curl -sSfL "$url" -o "$tmp/archive.$ext"; then
            if [ "$ext" = "zip" ]; then
              unzip -q "$tmp/archive.$ext" -d "$tmp"
            else
              tar -xzf "$tmp/archive.$ext" -C "$tmp"
            fi
            mv "$tmp/$bin_name" "$install_path"
            chmod +x "$install_path"
            echo "GO_ACTIONS_BIN=$install_path" >> "$GITHUB_ENV"
            echo "✅ Installed prebuilt go-actions v${version}"
            exit 0
          fi
          echo "⚠️  Prebuilt binary fetch failed; falling back to source build"
        else
          echo "ℹ️  No VERSION file or unsupported arch (${RUNNER_ARCH}); building from source"
        fi

        cd "$ACTION_PATH/../cli"
        go build -o "$install_path" ./cmd/go-actions
        echo "GO_ACTIONS_BIN=$install_path" >> "$GITHUB_ENV"
        echo "✅ Built go-actions from source"
```

**Why this shape:**
- `RUNNER_OS` / `RUNNER_ARCH` are GitHub-provided on every runner (Linux, macOS, Windows).
- `RUNNER_TEMP` works on Windows (no `/tmp`) and Linux/macOS alike.
- `GO_ACTIONS_BIN` is exported via `$GITHUB_ENV` so the next step reads it regardless of which path was taken.
- The fallback preserves today's behavior verbatim; any unforeseen issue with the download path degrades to source-build, not failure.

- [ ] **Step 2: Swap the hard-coded binary path in the `Run check` step**

Find line 172 (inside the `Run check` step):

```bash
        /tmp/go-actions check "$JOB" --format=json $comment_flag > /tmp/result.json 2>/tmp/result.stderr
```

Change to:

```bash
        "$GO_ACTIONS_BIN" check "$JOB" --format=json $comment_flag > /tmp/result.json 2>/tmp/result.stderr
```

- [ ] **Step 3: Shellcheck the modified YAML**

Extract the bash and lint it. Run:

```bash
python3 -c "
import yaml, sys
doc = yaml.safe_load(open('ci/action.yaml'))
for s in doc['runs']['steps']:
    if s.get('shell') == 'bash' and 'run' in s:
        sys.stdout.write(f\"# step: {s.get('name','?')}\n{s['run']}\n\")
" > /tmp/action-bash.sh
shellcheck -s bash /tmp/action-bash.sh || true
```

Expected: no `error` or `warning` lines from the new `Install go-actions CLI` step or the modified `Run check` step. Informational `SC2086` (word splitting for `$comment_flag`) is pre-existing and acceptable.

- [ ] **Step 4: Sanity-check YAML validity**

Run:

```bash
python3 -c "import yaml; yaml.safe_load(open('ci/action.yaml'))" && echo "OK"
```

Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add ci/action.yaml
git commit -m "feat(ci): download prebuilt go-actions CLI with source-build fallback"
```

---

## Task 3: Add Linux integration smoke test for the fast path

**Files:**
- Modify: `.github/workflows/ci.yaml`

This test verifies the download path: action checks out the branch, reads `VERSION`, downloads `go-actions_3.2.0_linux_amd64.tar.gz` (which exists on the latest published release), runs a test command, and asserts the success log line.

- [ ] **Step 1: Inspect `.github/workflows/ci.yaml` for existing structure**

Run:

```bash
cat .github/workflows/ci.yaml
```

Locate where existing jobs are defined and the style used (naming, triggers, reusable step patterns). Match that style in the new job.

- [ ] **Step 2: Add the fast-path smoke job**

Append a new job to `.github/workflows/ci.yaml`:

```yaml
  smoke-prebuilt-linux:
    name: Smoke test — prebuilt binary (Linux)
    runs-on: ubuntu-latest
    steps:
      - name: Checkout consumer workspace
        uses: actions/checkout@v4

      - name: Create minimal Go fixture
        run: |
          mkdir -p fixture && cd fixture
          go mod init example.com/fixture
          cat > main.go <<'EOF'
          package main
          func main() {}
          func Add(a, b int) int { return a + b }
          EOF
          cat > main_test.go <<'EOF'
          package main
          import "testing"
          func TestAdd(t *testing.T) {
              if Add(2, 3) != 5 { t.Fatal("broken") }
          }
          EOF

      - name: Run go-actions CI test job (capture logs)
        id: run
        uses: ./ci
        with:
          job: test
          working-directory: fixture
          github-comment: 'false'

      - name: Assert prebuilt path was taken
        env:
          LOG_FILE: ${{ runner.temp }}/action-log.txt
        run: |
          # The step above produces logs on stdout. GitHub doesn't let composite
          # steps return raw logs to a caller, so we assert via the job log UI
          # indirectly: re-run the install block standalone and check the marker.
          # (This is a post-hoc verification; the first `uses: ./ci` above proves
          # the action itself worked end-to-end.)
          echo "First invocation succeeded (exit 0 from uses: ./ci)."
          echo "Prebuilt path confirmed when logs show 'Installed prebuilt go-actions v'."
```

**Note:** GitHub Actions composite steps cannot directly return their stdout to a caller for grep-based assertions. The smoke test proves the action *works end-to-end* (exit 0 from `uses: ./ci`). To specifically assert the *prebuilt* path was taken rather than the fallback, rely on manual log review of the `smoke-prebuilt-linux` job after the PR runs. A stronger assertion mechanism would require emitting a step output from `ci/action.yaml`, which is a larger change deferred as a follow-up.

If you want the stronger assertion in this PR, add a step output to `ci/action.yaml` in the install step:

```yaml
    - name: Install go-actions CLI
      id: install
      # ... existing env ...
```

And inside the `run:` block, just before each `exit 0` / end-of-fallback-branch, add:

```bash
echo "install_source=prebuilt" >> "$GITHUB_OUTPUT"   # in the prebuilt branch
echo "install_source=source"   >> "$GITHUB_OUTPUT"   # in the fallback branch
```

Then add an output on the action:

```yaml
outputs:
  install_source:
    description: "How the CLI was obtained: 'prebuilt' or 'source'"
    value: ${{ steps.install.outputs.install_source }}
```

And the smoke job can assert on `steps.run.outputs.install_source`.

**Decision for this task:** include the `install_source` output mechanism. It's ~8 lines and makes the smoke tests genuinely verifiable. Apply it now in Step 3.

- [ ] **Step 3: Add `install_source` step output to `ci/action.yaml`**

Open `ci/action.yaml`. On the step added in Task 2 (`Install go-actions CLI`), add `id: install`:

```yaml
    - name: Install go-actions CLI
      id: install
      shell: bash
```

Inside the bash block, replace the two success paths to emit the output. Find:

```bash
            echo "✅ Installed prebuilt go-actions v${version}"
            exit 0
```

Change to:

```bash
            echo "install_source=prebuilt" >> "$GITHUB_OUTPUT"
            echo "✅ Installed prebuilt go-actions v${version}"
            exit 0
```

And find the final line:

```bash
        echo "✅ Built go-actions from source"
```

Change to:

```bash
        echo "install_source=source" >> "$GITHUB_OUTPUT"
        echo "✅ Built go-actions from source"
```

Add the action output. Find the `outputs:` block at the top of `ci/action.yaml`:

```yaml
outputs:
  coverage:
    description: "Test coverage percentage"
    value: ${{ steps.run-check.outputs.coverage }}
```

Add a new entry:

```yaml
  install_source:
    description: "How the CLI was obtained: 'prebuilt' or 'source'"
    value: ${{ steps.install.outputs.install_source }}
```

- [ ] **Step 4: Update the smoke job to assert on `install_source`**

Replace the placeholder `Assert` step from Step 2 with:

```yaml
      - name: Assert prebuilt path was taken
        env:
          SOURCE: ${{ steps.run.outputs.install_source }}
        run: |
          echo "install_source=$SOURCE"
          if [ "$SOURCE" != "prebuilt" ]; then
            echo "::error::Expected install_source=prebuilt, got $SOURCE"
            exit 1
          fi
```

- [ ] **Step 5: Validate YAML**

Run:

```bash
python3 -c "import yaml; yaml.safe_load(open('ci/action.yaml')); yaml.safe_load(open('.github/workflows/ci.yaml'))" && echo "OK"
```

Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add ci/action.yaml .github/workflows/ci.yaml
git commit -m "test(ci): add linux smoke test for prebuilt CLI download path"
```

---

## Task 4: Add Linux integration smoke test for the fallback path

**Files:**
- Modify: `.github/workflows/ci.yaml`

This test verifies that when the download would fail, the action falls back to source-build and the job still succeeds.

- [ ] **Step 1: Add the fallback smoke job**

Append a new job to `.github/workflows/ci.yaml`:

```yaml
  smoke-fallback-linux:
    name: Smoke test — source-build fallback (Linux)
    runs-on: ubuntu-latest
    steps:
      - name: Checkout consumer workspace
        uses: actions/checkout@v4

      - name: Create minimal Go fixture
        run: |
          mkdir -p fixture && cd fixture
          go mod init example.com/fixture
          cat > main.go <<'EOF'
          package main
          func main() {}
          func Add(a, b int) int { return a + b }
          EOF
          cat > main_test.go <<'EOF'
          package main
          import "testing"
          func TestAdd(t *testing.T) {
              if Add(2, 3) != 5 { t.Fatal("broken") }
          }
          EOF

      - name: Force fallback by deleting VERSION file
        run: rm -f VERSION

      - name: Run go-actions CI test job
        id: run
        uses: ./ci
        with:
          job: test
          working-directory: fixture
          github-comment: 'false'

      - name: Assert source-build fallback was taken
        env:
          SOURCE: ${{ steps.run.outputs.install_source }}
        run: |
          echo "install_source=$SOURCE"
          if [ "$SOURCE" != "source" ]; then
            echo "::error::Expected install_source=source, got $SOURCE"
            exit 1
          fi
```

**Why deleting `VERSION` forces the fallback:** the install step's check `[ -f "$version_file" ]` fails, so the fallback branch runs. This exercises the same code path as a ref that doesn't yet have a `VERSION` file (a common real-world case: `@main` between releases, forks, historical SHAs).

- [ ] **Step 2: Validate YAML**

Run:

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yaml'))" && echo "OK"
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yaml
git commit -m "test(ci): add linux smoke test for source-build fallback path"
```

---

## Task 5: Document platform support in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Locate the insertion point**

Run:

```bash
grep -n '^##' README.md | head -20
```

Identify an appropriate section header to insert the new section before (typically just before "Usage" or just after the introductory paragraph). Pick a location consistent with the existing structure.

- [ ] **Step 2: Add a "Platform support" section**

Insert the following section (adjust heading depth to match surrounding context if needed):

```markdown
## Platform support

The `ci` action downloads a prebuilt `go-actions` CLI binary when a tagged release is in use, falling back to a source-build otherwise.

| OS      | Architectures   | CI integration test |
| ------- | --------------- | ------------------- |
| Linux   | amd64, arm64    | ✅ Tested on every PR |
| Windows | amd64, arm64    | ⚠️  Built and published, not currently tested in CI |
| macOS   | amd64, arm64    | ⚠️  Built and published, not currently tested in CI |

Follow-up issues track adding runners for Windows and macOS integration testing.

If you hit a problem on Windows or macOS, please open an issue with the job log — the source-build fallback should keep things working even if the prebuilt download path has a bug.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document platform-support matrix for prebuilt CLI"
```

---

## Task 6: Open follow-up GitHub issues

**Files:** none (manual `gh` CLI task).

- [ ] **Step 1: Open issue — Windows integration testing**

Run:

```bash
gh issue create \
  --title "CI: add Windows runner for integration testing of prebuilt CLI" \
  --body "$(cat <<'EOF'
Forked from #75.

The ci action now publishes Windows binaries but has no Windows CI coverage (see \`docs/superpowers/specs/2026-04-21-prebuilt-cli-binaries-design.md\`).

## Work

- [ ] Provision a Windows runner (via gso or \`windows-latest\`)
- [ ] Add a Windows job to \`.github/workflows/ci.yaml\` that mirrors \`smoke-prebuilt-linux\` and \`smoke-fallback-linux\`
- [ ] Remove the "not currently tested" caveat from the README once Windows is covered

## Acceptance

Both the prebuilt path and the fallback path are verified on Windows on every PR.
EOF
)"
```

- [ ] **Step 2: Open issue — macOS integration testing**

Run:

```bash
gh issue create \
  --title "CI: add macOS runner for integration testing of prebuilt CLI" \
  --body "$(cat <<'EOF'
Forked from #75.

The ci action now publishes macOS binaries but has no macOS CI coverage. macOS runners are expensive on GitHub-hosted infrastructure and are not currently available via our self-hosted setup.

## Work

- [ ] Decide on runner source (GitHub-hosted \`macos-latest\` vs self-hosted)
- [ ] Add a macOS job to \`.github/workflows/ci.yaml\` that mirrors the Linux smoke jobs
- [ ] Remove the "not currently tested" caveat from the README once macOS is covered

## Acceptance

Both the prebuilt path and the fallback path are verified on macOS on every PR.
EOF
)"
```

- [ ] **Step 3: Open issue — govulncheck distribution**

Run:

```bash
gh issue create \
  --title "perf: evaluate govulncheck distribution strategy" \
  --body "$(cat <<'EOF'
Spun off from #75.

The original issue proposed publishing prebuilt \`govulncheck\` binaries. During design we scoped it out of the CLI-prebuilt work because:

- \`govulncheck\` runs in a single job (security), not every job
- \`go install\` piggybacks on the Go toolchain that is already installed for the security job
- The per-run cost is ~10–30s, a fraction of the CLI rebuild cost we fixed

If \`go install\` for govulncheck ever becomes a measurable bottleneck, evaluate:

1. **\`actions/cache\`** keyed on \`govulncheck-{version}-{go-minor}-{os}-{arch}\` — first run builds, subsequent runs restore.
2. **Bundle govulncheck into our release assets** — pin a version per go-actions release, build and publish alongside \`go-actions\`, fall back to \`go install\` if the consumer requests a different \`govulncheck-version\`.

See \`docs/superpowers/specs/2026-04-21-prebuilt-cli-binaries-design.md\` for full context.
EOF
)"
```

- [ ] **Step 4: Record the issue numbers in the spec follow-ups section (optional)**

Once issues are created, edit `docs/superpowers/specs/2026-04-21-prebuilt-cli-binaries-design.md` to link the new issue numbers next to each follow-up bullet, and commit:

```bash
git add docs/superpowers/specs/2026-04-21-prebuilt-cli-binaries-design.md
git commit -m "docs: link follow-up issues in prebuilt-cli spec"
```

---

## Task 7: Push and verify CI

- [ ] **Step 1: Push the branch**

Run:

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Open a PR**

Run:

```bash
gh pr create --fill --base main
```

- [ ] **Step 3: Wait for CI and verify both smoke jobs pass**

Run:

```bash
gh pr checks --watch
```

Expected: `smoke-prebuilt-linux` and `smoke-fallback-linux` both pass. Inspect the `smoke-prebuilt-linux` logs for the line `Installed prebuilt go-actions v3.2.0` to confirm the download URL was valid against the current latest release.

- [ ] **Step 4: If `smoke-prebuilt-linux` fails with a 404**

This means the download URL does not match the GoReleaser archive name. Most likely cause: `go-actions-v3.2.0` was published without one of the expected archives, or the archive naming diverges from `go-actions_<version>_<os>_<arch>.<ext>`.

Verify the assets published under `go-actions-v3.2.0`:

```bash
gh release view go-actions-v3.2.0 --json assets --jq '.assets[].name'
```

Expected names include `go-actions_3.2.0_linux_amd64.tar.gz`. If they don't match, adjust the URL template in `ci/action.yaml` to match the actual asset names and commit the fix.

---

## Self-review notes

- **Spec coverage check:** every section of the spec (Approach → Version resolution, Download step, GoReleaser, Testing, Rollout, Backwards compatibility, Release-job ordering, Follow-ups) has at least one task. Release-job ordering is implicitly covered by the fallback (no task needed beyond what Task 2 already implements); the spec notes it as an observation, not a requirement.
- **Type/name consistency:** `GO_ACTIONS_BIN`, `install_source`, and the `Install go-actions CLI` step `id: install` are referenced consistently across Tasks 2, 3, and 4.
- **No placeholders:** every code block shows complete content. Task 1 Step 2 offers a concrete fallback for the `extra-files` edge case, not a TBD. Task 6 bodies are fully written.
- **Ordering:** Task 3 depends on the `install_source` output added within Task 3 itself (Steps 3–4) because it genuinely needs the output from Task 2's step. Alternative phrasing would have been to fold the output into Task 2, but keeping it in Task 3 keeps Task 2 focused on "replace build with download" and Task 3 focused on "make it testable."
