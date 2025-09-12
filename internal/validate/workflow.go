package validate

import (
	"fmt"
	"strings"
)

// GitHubWorkflow represents the structure of a GitHub Actions workflow
type GitHubWorkflow struct {
	Name string                 `yaml:"name"`
	On   interface{}           `yaml:"on"`
	Jobs map[string]Job        `yaml:"jobs"`
}

// Job represents a single job in the workflow
type Job struct {
	RunsOn string `yaml:"runs-on"`
	Steps  []Step `yaml:"steps"`
	Needs  interface{} `yaml:"needs,omitempty"`
	If     string `yaml:"if,omitempty"`
}

// Step represents a single step in a job
type Step struct {
	Name string                 `yaml:"name,omitempty"`
	Uses string                 `yaml:"uses,omitempty"`
	Run  string                 `yaml:"run,omitempty"`
	With map[string]interface{} `yaml:"with,omitempty"`
}

// ValidateWorkflow validates a GitHub Actions workflow for go-actions best practices
func ValidateWorkflow(workflow *GitHubWorkflow) []string {
	var errors []string

	// Check for common go-actions misconfigurations
	errors = append(errors, validateGoActionsUsage(workflow)...)
	errors = append(errors, validateJobStructure(workflow)...)
	errors = append(errors, validateCommentJob(workflow)...)

	return errors
}

// validateGoActionsUsage checks for proper usage of go-actions
func validateGoActionsUsage(workflow *GitHubWorkflow) []string {
	var errors []string

	for jobName, job := range workflow.Jobs {
		for stepIndex, step := range job.Steps {
			if strings.Contains(step.Uses, "jrschumacher/go-actions") {
				errors = append(errors, validateGoActionsStep(jobName, stepIndex, step)...)
			}
		}
	}

	return errors
}

// validateGoActionsStep validates a specific go-actions step
func validateGoActionsStep(jobName string, stepIndex int, step Step) []string {
	var errors []string

	// Check for deprecated ci action with comment job
	if strings.Contains(step.Uses, "go-actions/ci") {
		if job, exists := step.With["job"]; exists {
			if job == "comment" {
				errors = append(errors, fmt.Sprintf(
					"job '%s' step %d: Invalid job type 'comment' for ci action. Use 'jrschumacher/go-actions/comment@v1' instead",
					jobName, stepIndex+1,
				))
			}
		}
	}

	// Check for proper job parameter
	if strings.Contains(step.Uses, "go-actions/ci") {
		if job, exists := step.With["job"]; exists {
			validJobs := []string{"test", "lint", "benchmark"}
			jobStr := fmt.Sprintf("%v", job)
			
			valid := false
			for _, validJob := range validJobs {
				if jobStr == validJob {
					valid = true
					break
				}
			}

			if !valid {
				errors = append(errors, fmt.Sprintf(
					"job '%s' step %d: Invalid job type '%s'. Valid options are: %s",
					jobName, stepIndex+1, jobStr, strings.Join(validJobs, ", "),
				))
			}
		} else {
			errors = append(errors, fmt.Sprintf(
				"job '%s' step %d: Missing required 'job' parameter for go-actions/ci",
				jobName, stepIndex+1,
			))
		}
	}

	// Check for recommended checkout step before go-actions
	if strings.Contains(step.Uses, "jrschumacher/go-actions") && stepIndex > 0 {
		foundCheckout := false
		for i := 0; i < stepIndex; i++ {
			if strings.Contains(step.Uses, "actions/checkout") {
				foundCheckout = true
				break
			}
		}

		if !foundCheckout {
			errors = append(errors, fmt.Sprintf(
				"job '%s' step %d: Missing checkout step before go-actions. Add 'uses: actions/checkout@v4'",
				jobName, stepIndex+1,
			))
		}
	}

	return errors
}

// validateJobStructure validates overall job structure
func validateJobStructure(workflow *GitHubWorkflow) []string {
	var errors []string

	// Check for basic required jobs
	hasTest := false
	hasLint := false

	for jobName := range workflow.Jobs {
		switch jobName {
		case "test":
			hasTest = true
		case "lint":
			hasLint = true
		}
	}

	if !hasTest {
		errors = append(errors, "Missing recommended 'test' job")
	}

	if !hasLint {
		errors = append(errors, "Missing recommended 'lint' job")
	}

	return errors
}

// validateCommentJob validates the comment job if present
func validateCommentJob(workflow *GitHubWorkflow) []string {
	var errors []string

	if commentJob, exists := workflow.Jobs["comment"]; exists {
		// Check if comment job has proper needs
		if commentJob.Needs == nil {
			errors = append(errors, "comment job should depend on other jobs using 'needs'")
		}

		// Check if comment job has proper if condition for PRs
		if !strings.Contains(commentJob.If, "pull_request") {
			errors = append(errors, "comment job should include 'github.event_name == \"pull_request\"' in 'if' condition")
		}

		// Check if using correct action
		foundCorrectAction := false
		for _, step := range commentJob.Steps {
			if strings.Contains(step.Uses, "go-actions/comment") {
				foundCorrectAction = true
				break
			}
		}

		if !foundCorrectAction {
			errors = append(errors, "comment job should use 'jrschumacher/go-actions/comment@v1' action")
		}
	}

	return errors
}