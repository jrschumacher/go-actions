package github_test

import (
	"fmt"

	"github.com/jrschumacher/go-actions/cli/internal/github"
)

func ExampleDetectGitHub() {
	// DetectGitHub returns nil when not running in GitHub Actions
	ctx := github.DetectGitHub()
	if ctx == nil {
		fmt.Println("Not running in GitHub Actions")
		return
	}

	// When in GitHub Actions, all context information is available
	fmt.Printf("Running in GitHub Actions: %s\n", ctx.EventName)
	fmt.Printf("Repository: %s/%s\n", ctx.Owner, ctx.Repo)
	if ctx.PRNumber > 0 {
		fmt.Printf("PR Number: %d\n", ctx.PRNumber)
	}
}

func ExampleDetectGitHub_checkEnvironment() {
	ctx := github.DetectGitHub()

	if ctx != nil && ctx.Token != "" {
		fmt.Println("GitHub token available for API calls")
	}

	if ctx != nil && ctx.PRNumber > 0 {
		fmt.Printf("PR #%d detected\n", ctx.PRNumber)
	}
}
