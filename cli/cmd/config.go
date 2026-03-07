package cmd

import (
	"fmt"
	"os"
	"strconv"

	"github.com/jrschumacher/go-actions/cli/internal/config"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage go-actions configuration",
}

var configGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get a configuration value by dot-separated key path",
	Long: `Get a single configuration value from .go-actions.yaml.

Keys use dot-separated paths matching the YAML structure:
  ci.test.args
  ci.lint.version
  ci.benchmark.count
  ci.security.args
  release.goreleaser.args
  output.format

Returns the value to stdout. Returns empty string if the key is not found.`,
	Args: cobra.ExactArgs(1),
	RunE: runConfigGet,
}

func init() {
	rootCmd.AddCommand(configCmd)
	configCmd.AddCommand(configGetCmd)
}

func runConfigGet(cmd *cobra.Command, args []string) error {
	configPath := cfgFile
	if configPath == "" {
		var err error
		configPath, err = config.FindConfigFile()
		if err != nil {
			return fmt.Errorf("failed to find config file: %w", err)
		}
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	value := getConfigValue(cfg, args[0])
	fmt.Fprint(os.Stdout, value)
	return nil
}

// getConfigValue retrieves a config value by dot-separated key path.
func getConfigValue(cfg *config.Config, key string) string {
	switch key {
	// CI - Go
	case "ci.go.version":
		return cfg.CI.Go.Version
	case "ci.go.version-file":
		return cfg.CI.Go.VersionFile

	// CI - Test
	case "ci.test.args":
		return cfg.CI.Test.Args
	case "ci.test.enabled":
		if cfg.CI.Test.Enabled != nil {
			return strconv.FormatBool(*cfg.CI.Test.Enabled)
		}
		return ""
	case "ci.test.coverage.threshold":
		return strconv.FormatFloat(cfg.CI.Test.Coverage.Threshold, 'f', -1, 64)
	case "ci.test.coverage.enabled":
		if cfg.CI.Test.Coverage.Enabled != nil {
			return strconv.FormatBool(*cfg.CI.Test.Coverage.Enabled)
		}
		return ""

	// CI - Lint
	case "ci.lint.args":
		return cfg.CI.Lint.Args
	case "ci.lint.version":
		return cfg.CI.Lint.Version
	case "ci.lint.enabled":
		return strconv.FormatBool(cfg.CI.Lint.Enabled)

	// CI - Benchmark
	case "ci.benchmark.args":
		return cfg.CI.Benchmark.Args
	case "ci.benchmark.count":
		return strconv.Itoa(cfg.CI.Benchmark.Count)
	case "ci.benchmark.enabled":
		return strconv.FormatBool(cfg.CI.Benchmark.Enabled)

	// CI - Security
	case "ci.security.args":
		return cfg.CI.Security.Args
	case "ci.security.version":
		return cfg.CI.Security.Version
	case "ci.security.fail-on":
		return cfg.CI.Security.FailOn
	case "ci.security.enabled":
		return strconv.FormatBool(cfg.CI.Security.Enabled)

	// Release
	case "release.strategy":
		return cfg.Release.Strategy
	case "release.goreleaser.args":
		return cfg.Release.GoReleaser.Args
	case "release.release-please.release-type":
		return cfg.Release.ReleasePlease.ReleaseType

	// Output
	case "output.format":
		return cfg.Output.Format
	case "output.verbosity":
		return cfg.Output.Verbosity

	default:
		return ""
	}
}
