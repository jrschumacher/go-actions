package validate

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewValidator(t *testing.T) {
	tests := []struct {
		name       string
		workingDir string
		want       string
	}{
		{
			name:       "empty working dir defaults to current",
			workingDir: "",
			want:       ".",
		},
		{
			name:       "custom working dir",
			workingDir: "/tmp/test",
			want:       "/tmp/test",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := NewValidator(tt.workingDir)
			if v.workingDir != tt.want {
				t.Errorf("NewValidator() workingDir = %v, want %v", v.workingDir, tt.want)
			}
		})
	}
}

func TestGetMajorVersion(t *testing.T) {
	v := NewValidator(".")
	tests := []struct {
		name    string
		version string
		want    string
	}{
		{
			name:    "v2 format",
			version: "v2",
			want:    "2",
		},
		{
			name:    "v1.54.2 format",
			version: "v1.54.2",
			want:    "1",
		},
		{
			name:    "2 without v prefix",
			version: "2",
			want:    "2",
		},
		{
			name:    "1.54.2 without v prefix",
			version: "1.54.2",
			want:    "1",
		},
		{
			name:    "invalid version",
			version: "invalid",
			want:    "",
		},
		{
			name:    "empty version",
			version: "",
			want:    "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := v.getMajorVersion(tt.version)
			if got != tt.want {
				t.Errorf("getMajorVersion(%q) = %q, want %q", tt.version, got, tt.want)
			}
		})
	}
}

func TestCheckGolangciVersion(t *testing.T) {
	tests := []struct {
		name            string
		workflowVersion string
		configVersion   string
		wantError       bool
	}{
		{
			name:            "matching v2 versions",
			workflowVersion: "v2.0.2",
			configVersion:   "2",
			wantError:       false,
		},
		{
			name:            "matching v1 versions",
			workflowVersion: "v1.54.2",
			configVersion:   "1",
			wantError:       false,
		},
		{
			name:            "mismatched versions",
			workflowVersion: "v2.0.2",
			configVersion:   "1",
			wantError:       true,
		},
		{
			name:            "empty workflow version",
			workflowVersion: "",
			configVersion:   "2",
			wantError:       false,
		},
		{
			name:            "empty config version",
			workflowVersion: "v2.0.2",
			configVersion:   "",
			wantError:       false,
		},
		{
			name:            "both empty",
			workflowVersion: "",
			configVersion:   "",
			wantError:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			issue := CheckGolangciVersion(tt.workflowVersion, tt.configVersion)
			if tt.wantError && issue == nil {
				t.Error("CheckGolangciVersion() expected error, got nil")
			}
			if !tt.wantError && issue != nil {
				t.Errorf("CheckGolangciVersion() unexpected error: %v", issue.Message)
			}
		})
	}
}

func TestExtractActionVersion(t *testing.T) {
	v := NewValidator(".")
	tests := []struct {
		name       string
		content    string
		actionName string
		want       string
	}{
		{
			name:       "extract v1",
			content:    "uses: jrschumacher/go-actions/ci@v1",
			actionName: "ci",
			want:       "v1",
		},
		{
			name:       "extract main",
			content:    "uses: jrschumacher/go-actions/release@main",
			actionName: "release",
			want:       "main",
		},
		{
			name:       "extract commit hash",
			content:    "uses: jrschumacher/go-actions/self-validate@abc123",
			actionName: "self-validate",
			want:       "abc123",
		},
		{
			name:       "no match",
			content:    "uses: other/action@v1",
			actionName: "ci",
			want:       "unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := v.extractActionVersion(tt.content, tt.actionName)
			if got != tt.want {
				t.Errorf("extractActionVersion() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestExtractWorkflowConfig(t *testing.T) {
	v := NewValidator(".")
	tests := []struct {
		name       string
		content    string
		actionName string
		wantVer    string
	}{
		{
			name: "extract golangci-lint-version",
			content: `
uses: jrschumacher/go-actions/ci@v1
with:
  job: lint
  golangci-lint-version: v2.1.0
`,
			actionName: "ci",
			wantVer:    "v2.1.0",
		},
		{
			name: "no version specified",
			content: `
uses: jrschumacher/go-actions/ci@v1
with:
  job: test
`,
			actionName: "ci",
			wantVer:    "",
		},
		{
			name: "version with quotes",
			content: `
uses: jrschumacher/go-actions/ci@v1
with:
  golangci-lint-version: "v2.0.0"
`,
			actionName: "ci",
			wantVer:    "v2.0.0",
		},
		{
			name:       "action not found",
			content:    "uses: other/action@v1",
			actionName: "ci",
			wantVer:    "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := v.extractWorkflowConfig(tt.content, tt.actionName)
			if config.GolangciLintVersion != tt.wantVer {
				t.Errorf("extractWorkflowConfig() GolangciLintVersion = %q, want %q", config.GolangciLintVersion, tt.wantVer)
			}
		})
	}
}

func TestValidateGolangciLintAction(t *testing.T) {
	v := NewValidator(".")
	tests := []struct {
		name      string
		content   string
		wantError bool
	}{
		{
			name: "compatible v8 with v2 golangci-lint",
			content: `
- uses: golangci/golangci-lint-action@v8
  with:
    version: v2.0.0
`,
			wantError: false,
		},
		{
			name: "incompatible v8 with v1 golangci-lint",
			content: `
- uses: golangci/golangci-lint-action@v8
  with:
    version: v1.54.2
`,
			wantError: true,
		},
		{
			name: "incompatible v7 with v1 golangci-lint",
			content: `
- uses: golangci/golangci-lint-action@v7
  with:
    version: v1.54.2
`,
			wantError: true,
		},
		{
			name: "compatible v6 with v1 golangci-lint",
			content: `
- uses: golangci/golangci-lint-action@v6
  with:
    version: v1.54.2
`,
			wantError: false,
		},
		{
			name: "no version specified",
			content: `
- uses: golangci/golangci-lint-action@v8
`,
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := &ValidationResult{
				Errors: []ValidationIssue{},
			}
			v.validateGolangciLintAction(tt.content, result)
			hasError := len(result.Errors) > 0
			if hasError != tt.wantError {
				t.Errorf("validateGolangciLintAction() hasError = %v, want %v, errors: %+v", hasError, tt.wantError, result.Errors)
			}
		})
	}
}

func TestValidateGoReleaserConfig(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir, err := os.MkdirTemp("", "validate-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	tests := []struct {
		name         string
		configFile   string
		content      string
		wantErrors   int
		wantWarnings int
	}{
		{
			name:       "valid config",
			configFile: ".goreleaser.yaml",
			content: `
builds:
  - binary: "{{ .ProjectName }}"
    goos:
      - linux
      - darwin
`,
			wantErrors:   0,
			wantWarnings: 0,
		},
		{
			name:       "missing builds section",
			configFile: ".goreleaser.yaml",
			content: `
archives:
  - format: tar.gz
`,
			wantErrors:   1,
			wantWarnings: 0,
		},
		{
			name:       "binary without ProjectName",
			configFile: ".goreleaser.yaml",
			content: `
builds:
  - binary: myapp
`,
			wantErrors:   0,
			wantWarnings: 1,
		},
		{
			name:       "zip format for linux",
			configFile: ".goreleaser.yaml",
			content: `
builds:
  - binary: "{{ .ProjectName }}"
archives:
  - format: zip
    goos: linux
`,
			wantErrors:   0,
			wantWarnings: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create config file
			configPath := filepath.Join(tmpDir, tt.configFile)
			if err := os.WriteFile(configPath, []byte(tt.content), 0644); err != nil {
				t.Fatal(err)
			}

			v := NewValidator(tmpDir)
			result := &ValidationResult{
				Errors:   []ValidationIssue{},
				Warnings: []ValidationIssue{},
			}

			v.validateGoReleaserConfig(result)

			if len(result.Errors) != tt.wantErrors {
				t.Errorf("validateGoReleaserConfig() errors = %d, want %d, errors: %+v", len(result.Errors), tt.wantErrors, result.Errors)
			}
			if len(result.Warnings) != tt.wantWarnings {
				t.Errorf("validateGoReleaserConfig() warnings = %d, want %d, warnings: %+v", len(result.Warnings), tt.wantWarnings, result.Warnings)
			}

			// Clean up
			_ = os.Remove(configPath)
		})
	}
}

func TestValidateProject(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir, err := os.MkdirTemp("", "validate-project-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	// Create .github/workflows directory
	workflowDir := filepath.Join(tmpDir, ".github", "workflows")
	if err := os.MkdirAll(workflowDir, 0755); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name          string
		setupFiles    map[string]string
		workflowPaths []string
		wantValid     bool
		wantActions   int
		wantErrors    int
	}{
		{
			name: "valid CI workflow with go.mod",
			setupFiles: map[string]string{
				".github/workflows/ci.yaml": `
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: test
`,
				"go.mod": "module example.com/test\n\ngo 1.22\n",
			},
			wantValid:   true,
			wantActions: 1,
			wantErrors:  0,
		},
		{
			name: "CI workflow missing go.mod",
			setupFiles: map[string]string{
				".github/workflows/ci.yaml": `
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: test
`,
			},
			wantValid:   false,
			wantActions: 1,
			wantErrors:  1,
		},
		{
			name: "release workflow with missing configs",
			setupFiles: map[string]string{
				".github/workflows/release.yaml": `
name: Release
on:
  push:
    tags:
      - 'v*'
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/release@v1
`,
			},
			wantValid:   false,
			wantActions: 1,
			wantErrors:  3, // missing release-please-config.json, .release-please-manifest.json, .goreleaser.yaml
		},
		{
			name: "valid release workflow with all configs",
			setupFiles: map[string]string{
				".github/workflows/release.yaml": `
name: Release
on:
  push:
    tags:
      - 'v*'
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/release@v1
`,
				"release-please-config.json": `{"release-type": "go"}`,
				".release-please-manifest.json": `{".": "0.1.0"}`,
				".goreleaser.yaml": `
builds:
  - binary: "{{ .ProjectName }}"
`,
			},
			wantValid:   true,
			wantActions: 1,
			wantErrors:  0,
		},
		{
			name: "no workflows",
			setupFiles: map[string]string{
				"go.mod": "module example.com/test\n\ngo 1.22\n",
			},
			wantValid:   true,
			wantActions: 0,
			wantErrors:  0,
		},
		{
			name: "incompatible golangci-lint version",
			setupFiles: map[string]string{
				".github/workflows/ci.yaml": `
name: CI
on: [push]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: lint
          golangci-lint-version: v1.54.2
`,
				"go.mod": "module example.com/test\n\ngo 1.22\n",
			},
			wantValid:   false,
			wantActions: 1,
			wantErrors:  1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clean up previous test files
			files, _ := filepath.Glob(filepath.Join(tmpDir, "*"))
			for _, f := range files {
				if filepath.Base(f) != ".github" {
					_ = os.RemoveAll(f)
				}
			}
			_ = os.RemoveAll(workflowDir)
			_ = os.MkdirAll(workflowDir, 0755)

			// Setup files
			for path, content := range tt.setupFiles {
				fullPath := filepath.Join(tmpDir, path)
				dir := filepath.Dir(fullPath)
				if err := os.MkdirAll(dir, 0755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
					t.Fatal(err)
				}
			}

			result, err := ValidateProject(tmpDir, tt.workflowPaths)
			if err != nil {
				t.Fatalf("ValidateProject() error = %v", err)
			}

			if result.Valid != tt.wantValid {
				t.Errorf("ValidateProject() Valid = %v, want %v", result.Valid, tt.wantValid)
			}
			if len(result.Actions) != tt.wantActions {
				t.Errorf("ValidateProject() Actions count = %d, want %d", len(result.Actions), tt.wantActions)
			}
			if len(result.Errors) != tt.wantErrors {
				t.Errorf("ValidateProject() Errors count = %d, want %d, errors: %+v", len(result.Errors), tt.wantErrors, result.Errors)
			}
		})
	}
}

func TestIsGoActionsRepo(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir, err := os.MkdirTemp("", "go-actions-repo-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	tests := []struct {
		name       string
		setupFiles []string
		want       bool
	}{
		{
			name: "is go-actions repo",
			setupFiles: []string{
				"ci/action.yaml",
				"release/action.yaml",
				"self-validate/action.yaml",
			},
			want: true,
		},
		{
			name: "missing ci action",
			setupFiles: []string{
				"release/action.yaml",
				"self-validate/action.yaml",
			},
			want: false,
		},
		{
			name: "missing release action",
			setupFiles: []string{
				"ci/action.yaml",
				"self-validate/action.yaml",
			},
			want: false,
		},
		{
			name:       "no action files",
			setupFiles: []string{},
			want:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clean up
			_ = os.RemoveAll(tmpDir)
			_ = os.MkdirAll(tmpDir, 0755)

			// Setup files
			for _, file := range tt.setupFiles {
				fullPath := filepath.Join(tmpDir, file)
				dir := filepath.Dir(fullPath)
				if err := os.MkdirAll(dir, 0755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(fullPath, []byte("test"), 0644); err != nil {
					t.Fatal(err)
				}
			}

			v := NewValidator(tmpDir)
			got := v.isGoActionsRepo()
			if got != tt.want {
				t.Errorf("isGoActionsRepo() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestValidateReleasePleaseConfig(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir, err := os.MkdirTemp("", "release-please-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	tests := []struct {
		name       string
		setupFiles []string
		wantErrors int
	}{
		{
			name: "both files present",
			setupFiles: []string{
				"release-please-config.json",
				".release-please-manifest.json",
			},
			wantErrors: 0,
		},
		{
			name: "missing config",
			setupFiles: []string{
				".release-please-manifest.json",
			},
			wantErrors: 1,
		},
		{
			name: "missing manifest",
			setupFiles: []string{
				"release-please-config.json",
			},
			wantErrors: 1,
		},
		{
			name:       "both missing",
			setupFiles: []string{},
			wantErrors: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clean up
			_ = os.RemoveAll(tmpDir)
			_ = os.MkdirAll(tmpDir, 0755)

			// Setup files
			for _, file := range tt.setupFiles {
				fullPath := filepath.Join(tmpDir, file)
				if err := os.WriteFile(fullPath, []byte("{}"), 0644); err != nil {
					t.Fatal(err)
				}
			}

			v := NewValidator(tmpDir)
			result := &ValidationResult{
				Errors: []ValidationIssue{},
			}

			v.validateReleasePleaseConfig(result)

			if len(result.Errors) != tt.wantErrors {
				t.Errorf("validateReleasePleaseConfig() errors = %d, want %d, errors: %+v", len(result.Errors), tt.wantErrors, result.Errors)
			}
		})
	}
}

func TestFindWorkflowFiles(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir, err := os.MkdirTemp("", "workflow-files-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	// Create workflow directory and files
	workflowDir := filepath.Join(tmpDir, ".github", "workflows")
	if err := os.MkdirAll(workflowDir, 0755); err != nil {
		t.Fatal(err)
	}

	files := []string{"ci.yaml", "release.yml", "other.yaml"}
	for _, file := range files {
		fullPath := filepath.Join(workflowDir, file)
		if err := os.WriteFile(fullPath, []byte("test"), 0644); err != nil {
			t.Fatal(err)
		}
	}

	tests := []struct {
		name      string
		patterns  []string
		wantCount int
		wantErr   bool
	}{
		{
			name:      "default patterns",
			patterns:  []string{},
			wantCount: 3,
			wantErr:   false,
		},
		{
			name:      "yaml only",
			patterns:  []string{filepath.Join(tmpDir, ".github/workflows/*.yaml")},
			wantCount: 2,
			wantErr:   false,
		},
		{
			name:      "yml only",
			patterns:  []string{filepath.Join(tmpDir, ".github/workflows/*.yml")},
			wantCount: 1,
			wantErr:   false,
		},
		{
			name:      "both patterns explicitly",
			patterns:  []string{filepath.Join(tmpDir, ".github/workflows/*.yaml"), filepath.Join(tmpDir, ".github/workflows/*.yml")},
			wantCount: 3,
			wantErr:   false,
		},
		{
			name:      "non-existent pattern",
			patterns:  []string{filepath.Join(tmpDir, ".github/workflows/*.txt")},
			wantCount: 0,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := NewValidator(tmpDir)
			files, err := v.findWorkflowFiles(tt.patterns)
			if (err != nil) != tt.wantErr {
				t.Errorf("findWorkflowFiles() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if len(files) != tt.wantCount {
				t.Errorf("findWorkflowFiles() count = %d, want %d", len(files), tt.wantCount)
			}
		})
	}
}
