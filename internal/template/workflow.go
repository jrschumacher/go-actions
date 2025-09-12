package template

import (
	"bytes"
	"fmt"
	"text/template"

	"github.com/jrschumacher/go-actions/internal/detect"
)

const workflowTemplate = `name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run Tests
        uses: jrschumacher/go-actions/ci@v1
        with:
          job: test{{if .GoVersion}}
          go-version: "{{.GoVersion}}"{{end}}

  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run Lint
        uses: jrschumacher/go-actions/ci@v1
        with:
          job: lint{{if .GoVersion}}
          go-version: "{{.GoVersion}}"{{end}}{{if .HasLintConfig}}
          lint-config: "{{.LintConfigPath}}"{{end}}
{{if .HasBenchmarks}}
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run Benchmarks
        uses: jrschumacher/go-actions/ci@v1
        with:
          job: benchmark{{if .GoVersion}}
          go-version: "{{.GoVersion}}"{{end}}
{{end}}{{if .ShouldComment}}
  comment:
    runs-on: ubuntu-latest
    needs: [test, lint{{if .HasBenchmarks}}, benchmark{{end}}]
    if: always() && github.event_name == 'pull_request'
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Post CI Results
        uses: jrschumacher/go-actions/comment@v1
{{end}}`

// WorkflowData represents the data passed to the workflow template
type WorkflowData struct {
	*detect.ProjectConfig
	ShouldComment bool
}

// GenerateWorkflow creates a GitHub Actions workflow based on project configuration
func GenerateWorkflow(config *detect.ProjectConfig) (string, error) {
	data := WorkflowData{
		ProjectConfig: config,
		ShouldComment: true, // Always include comment job for now
	}

	tmpl, err := template.New("workflow").Parse(workflowTemplate)
	if err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}

// GetWorkflowPath returns the standard path for the CI workflow
func GetWorkflowPath() string {
	return ".github/workflows/ci.yml"
}

// GetWorkflowDir returns the workflows directory
func GetWorkflowDir() string {
	return ".github/workflows"
}