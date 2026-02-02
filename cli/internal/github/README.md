# github

GitHub Actions environment detection package for the go-actions CLI.

## Overview

This package provides utilities for detecting and parsing GitHub Actions environment variables, enabling the CLI to understand its execution context and behave appropriately when running in GitHub Actions vs. locally.

## Features

- **Environment Detection**: Automatically detects if running in GitHub Actions
- **Context Parsing**: Extracts all relevant GitHub Actions context information
- **PR Number Detection**: Intelligently parses PR numbers from event files
- **GHES Support**: Handles GitHub Enterprise Server custom URLs
- **Error Resilience**: Gracefully handles missing or invalid environment variables

## Usage

### Basic Detection

```go
import "github.com/jrschumacher/go-actions/cli/internal/github"

func main() {
    ctx := github.DetectGitHub()
    if ctx == nil {
        // Not running in GitHub Actions
        fmt.Println("Running locally")
        return
    }

    // Running in GitHub Actions
    fmt.Printf("Event: %s\n", ctx.EventName)
    fmt.Printf("Repository: %s/%s\n", ctx.Owner, ctx.Repo)
}
```

### Accessing Context Information

```go
ctx := github.DetectGitHub()
if ctx != nil {
    // Check if this is a PR event
    if ctx.PRNumber > 0 {
        fmt.Printf("Running for PR #%d\n", ctx.PRNumber)
    }

    // Access GitHub API information
    if ctx.Token != "" {
        fmt.Println("GitHub token available")
    }

    // Use GHES URLs if configured
    fmt.Printf("API URL: %s\n", ctx.APIURL)
}
```

## GitHubContext Fields

| Field | Type | Description |
|-------|------|-------------|
| `IsGitHubActions` | `bool` | Always `true` when returned (nil otherwise) |
| `EventName` | `string` | Event type (pull_request, push, etc.) |
| `Token` | `string` | GitHub token from GITHUB_TOKEN |
| `Repository` | `string` | Full repository name (owner/repo) |
| `Owner` | `string` | Repository owner |
| `Repo` | `string` | Repository name |
| `PRNumber` | `int` | Pull request number (0 if not a PR event) |
| `RunID` | `int64` | Workflow run ID |
| `ServerURL` | `string` | GitHub server URL (supports GHES) |
| `APIURL` | `string` | GitHub API URL (supports GHES) |

## Environment Variables

The package reads the following GitHub Actions environment variables:

- `GITHUB_ACTIONS`: Must be "true" to detect GitHub Actions
- `GITHUB_EVENT_NAME`: Event that triggered the workflow
- `GITHUB_TOKEN`: GitHub authentication token
- `GITHUB_REPOSITORY`: Repository name (owner/repo format)
- `GITHUB_RUN_ID`: Unique workflow run identifier
- `GITHUB_EVENT_PATH`: Path to event payload JSON file
- `GITHUB_SERVER_URL`: GitHub server URL (defaults to https://github.com)
- `GITHUB_API_URL`: GitHub API URL (defaults to https://api.github.com)

## PR Number Detection

The package intelligently extracts PR numbers from the event payload:

1. Prefers `.pull_request.number` (for push events referencing a PR)
2. Falls back to `.number` (for pull_request events)
3. Returns 0 if no PR number found

## GitHub Enterprise Server

The package fully supports GitHub Enterprise Server (GHES) by respecting custom server and API URLs:

```go
ctx := github.DetectGitHub()
if ctx != nil {
    // Will use custom URLs if GITHUB_SERVER_URL and GITHUB_API_URL are set
    fmt.Printf("Server: %s\n", ctx.ServerURL)
    fmt.Printf("API: %s\n", ctx.APIURL)
}
```

## Testing

The package includes comprehensive tests using `t.Setenv()` for isolated environment variable testing:

```bash
go test ./internal/github/
```

Test coverage includes:
- Environment detection with various configurations
- PR number parsing from event files
- GHES URL handling
- Error cases and invalid input
- Integration tests with realistic scenarios
