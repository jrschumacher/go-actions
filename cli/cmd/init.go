package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/jrschumacher/go-actions/cli/internal/config"
	"github.com/spf13/cobra"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize .go-actions.yaml with recommended settings",
	Long: `Initialize a .go-actions.yaml configuration file in the current directory.

This command creates a new configuration file with sensible defaults based on your project.`,
	RunE: runInit,
}

func init() {
	rootCmd.AddCommand(initCmd)
}

func runInit(cmd *cobra.Command, args []string) error {
	// Check if config already exists
	configPath := ".go-actions.yaml"
	if _, err := os.Stat(configPath); err == nil {
		return fmt.Errorf("config file already exists: %s", configPath)
	}

	// Create default config
	cfg := config.DefaultConfig()

	// Detect project settings
	if err := detectProjectSettings(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: %v\n", err)
	}

	// Save config
	if err := config.Save(cfg, configPath); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	fmt.Println("Created .go-actions.yaml with recommended settings")

	// Print what was detected
	if cfg.CI.Go.VersionFile != "" {
		fmt.Printf("Detected: Go version file: %s\n", cfg.CI.Go.VersionFile)
	}

	// Check for golangci-lint config
	if _, err := os.Stat(".golangci.yml"); err == nil {
		fmt.Println("Detected: golangci-lint config present")
	} else if _, err := os.Stat(".golangci.yaml"); err == nil {
		fmt.Println("Detected: golangci-lint config present")
	}

	return nil
}

func detectProjectSettings(cfg *config.Config) error {
	// Check for go.mod
	if _, err := os.Stat("go.mod"); err == nil {
		cfg.CI.Go.VersionFile = "go.mod"
	}

	// Check for .go-version
	if _, err := os.Stat(".go-version"); err == nil {
		cfg.CI.Go.VersionFile = ".go-version"
	}

	// Note: golangci-lint config detection is handled by the linter itself
	// Lint is enabled by default in the config

	// Look for test files to determine if testing is viable
	hasTests := false
	err := filepath.Walk(".", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip errors
		}
		if info.IsDir() && (info.Name() == "vendor" || info.Name() == ".git") {
			return filepath.SkipDir
		}
		if filepath.Ext(path) == ".go" && filepath.Base(path) != "go.mod" {
			// Check if it's a test file
			if len(filepath.Base(path)) > 8 && filepath.Base(path)[len(filepath.Base(path))-8:] == "_test.go" {
				hasTests = true
				return filepath.SkipAll
			}
		}
		return nil
	})

	if err == nil && !hasTests {
		fmt.Fprintln(os.Stderr, "Warning: No test files detected")
	}

	return nil
}
