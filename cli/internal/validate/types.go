package validate

// Options configures the validator
type Options struct {
	WorkingDir string
	Fix        bool
	Quiet      bool
}

// Result contains validation results
type Result struct {
	IsValid  bool
	Errors   []string
	Warnings []string
}

// GolangciConfig represents golangci-lint configuration
type GolangciConfig struct {
	Version         interface{}            `yaml:"version"`
	Linters         *LintersConfig         `yaml:"linters"`
	LintersSettings map[string]interface{} `yaml:"linters-settings"` // v1 schema (deprecated)
	Issues          *IssuesConfig          `yaml:"issues"`
	Run             map[string]interface{} `yaml:"run"`
}

// LintersConfig represents the linters section
type LintersConfig struct {
	Enable     []string `yaml:"enable"`
	Disable    []string `yaml:"disable"`
	EnableAll  bool     `yaml:"enable-all"`
	DisableAll bool     `yaml:"disable-all"`
	Preset     string   `yaml:"preset"`
}

// IssuesConfig represents the issues section
type IssuesConfig struct {
	ExcludeRules []interface{} `yaml:"exclude-rules"` // v1 schema (deprecated)
}
