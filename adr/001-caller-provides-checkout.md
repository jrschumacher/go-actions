# ADR-001: Caller Provides Checkout

**Status:** Accepted
**Date:** 2026-03-06

## Context

go-actions provides three composite actions: `ci`, `release`, and `self-validate`. Prior to v3, the approach to repository checkout was inconsistent:

- `ci` and `self-validate` expected the caller to checkout
- `release` performed checkout internally (with `fetch-depth: 0` and the PAT token)

This inconsistency caused confusion during v1-to-v3 migrations, where users forgot to add `actions/checkout@v4` before `self-validate@v3`.

## Decision

All go-actions composite actions require the caller to perform `actions/checkout` before invoking the action. No action performs checkout internally.

## Rationale

1. **Composability** — Callers often need to customize checkout (submodules, fetch-depth, LFS, sparse-checkout, tokens). Internal checkout either blocks these options or forces the action to proxy every `actions/checkout` input.

2. **No surprise side effects** — Composite actions that silently checkout can conflict with earlier checkout steps or working-directory setups.

3. **Convention** — Most well-maintained composite actions (golangci-lint-action, goreleaser-action, etc.) expect the repo to already be checked out.

4. **Transparency** — The workflow file clearly shows what's happening at each step.

5. **Consistency** — A single rule ("always checkout first") is easier to document and remember than per-action exceptions.

## Consequences

### For `ci` and `self-validate`

No change — these already required caller-provided checkout.

### For `release`

The internal checkout step is removed. Callers must provide checkout with the correct parameters:

```yaml
steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0
      token: ${{ secrets.RELEASE_PAT }}
  - uses: jrschumacher/go-actions/release@v3
    with:
      release-token: ${{ secrets.RELEASE_PAT }}
```

Both `fetch-depth: 0` (full history for release-please) and `token` (PAT for pushing release commits) are required. The `self-validate` action will check for these and warn if they are missing or misconfigured.

### Migration

This is a breaking change for `release` users upgrading within v3. The self-validate action should detect missing checkout steps and provide guidance in PR comments.
