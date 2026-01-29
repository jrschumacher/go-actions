package config

// Config represents the .go-actions.yaml configuration file
type Config struct {
	Version int          `yaml:"version"`
	CI      CIConfig     `yaml:"ci"`
	Release ReleaseConfig `yaml:"release,omitempty"`
	Local   LocalConfig  `yaml:"local,omitempty"`
	Output  OutputConfig `yaml:"output,omitempty"`
}

// CIConfig represents CI workflow configuration
type CIConfig struct {
	Go        GoConfig        `yaml:"go,omitempty"`
	Test      TestConfig      `yaml:"test,omitempty"`
	Lint      LintConfig      `yaml:"lint,omitempty"`
	Benchmark BenchmarkConfig `yaml:"benchmark,omitempty"`
	Security  SecurityConfig  `yaml:"security,omitempty"`
}

// GoConfig represents Go version configuration
type GoConfig struct {
	Version     string `yaml:"version,omitempty"`
	VersionFile string `yaml:"version-file,omitempty"`
}

// TestConfig represents test configuration
type TestConfig struct {
	Enabled  *bool          `yaml:"enabled,omitempty"`
	Args     string         `yaml:"args,omitempty"`
	Coverage CoverageConfig `yaml:"coverage,omitempty"`
}

// CoverageConfig represents coverage configuration
type CoverageConfig struct {
	Enabled   *bool   `yaml:"enabled,omitempty"`
	Threshold float64 `yaml:"threshold,omitempty"`
}

// LintConfig represents lint configuration
type LintConfig struct {
	Enabled bool   `yaml:"enabled,omitempty"`
	Version string `yaml:"version,omitempty"`
	Args    string `yaml:"args,omitempty"`
}

// BenchmarkConfig represents benchmark configuration
type BenchmarkConfig struct {
	Enabled bool   `yaml:"enabled,omitempty"`
	Args    string `yaml:"args,omitempty"`
	Count   int    `yaml:"count,omitempty"`
}

// SecurityConfig represents security scanning configuration
type SecurityConfig struct {
	Enabled bool   `yaml:"enabled,omitempty"`
	Version string `yaml:"version,omitempty"`
	Args    string `yaml:"args,omitempty"`
	FailOn  string `yaml:"fail-on,omitempty"`
}

// ReleaseConfig represents release workflow configuration
type ReleaseConfig struct {
	Strategy      string                     `yaml:"strategy,omitempty"`
	ReleasePlease ReleasePleaseConfig        `yaml:"release-please,omitempty"`
	GoReleaser    GoReleaserConfig           `yaml:"goreleaser,omitempty"`
}

// ReleasePleaseConfig represents Release Please specific configuration
type ReleasePleaseConfig struct {
	ReleaseType string   `yaml:"release-type,omitempty"`
	ExtraFiles  []string `yaml:"extra-files,omitempty"`
}

// GoReleaserConfig represents GoReleaser specific configuration
type GoReleaserConfig struct {
	Args string `yaml:"args,omitempty"`
}

// LocalConfig represents local development and CLI configuration
type LocalConfig struct {
	Hooks HooksConfig `yaml:"hooks,omitempty"`
	Agent AgentConfig `yaml:"agent,omitempty"`
}

// HooksConfig represents git hooks configuration
type HooksConfig struct {
	PreCommit []string `yaml:"pre-commit,omitempty"`
	PrePush   []string `yaml:"pre-push,omitempty"`
}

// AgentConfig represents AI agent features configuration
type AgentConfig struct {
	Enabled bool `yaml:"enabled,omitempty"`
	AutoFix bool `yaml:"auto-fix,omitempty"`
}

// OutputConfig represents output formatting configuration
type OutputConfig struct {
	Format    string `yaml:"format,omitempty"`
	Verbosity string `yaml:"verbosity,omitempty"`
}

// DefaultConfig returns a config with sensible defaults
func DefaultConfig() *Config {
	trueVal := true
	return &Config{
		Version: 1,
		CI: CIConfig{
			Test: TestConfig{
				Enabled: &trueVal,
				Args:    "-v -race ./...",
				Coverage: CoverageConfig{
					Enabled:   &trueVal,
					Threshold: 80.0,
				},
			},
			Lint: LintConfig{
				Enabled: true,
				Version: "v2.0.2",
				Args:    "run ./...",
			},
			Security: SecurityConfig{
				Enabled: true,
				Version: "latest",
				Args:    "./...",
				FailOn:  "high",
			},
			Benchmark: BenchmarkConfig{
				Enabled: false,
				Args:    "-bench=. -benchmem",
				Count:   5,
			},
		},
		Output: OutputConfig{
			Format:    "auto",
			Verbosity: "normal",
		},
	}
}
