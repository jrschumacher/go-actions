import { validateWorkflows, WorkflowValidator, ValidationResult, ValidationError } from './workflow-validator';
import { validateProject, ProjectValidator } from './validate-project';
import { storeJobResults, setProcessingState } from './unified-pr-comment';
import * as core from '@actions/core';
import * as github from '@actions/github';

export interface SelfValidateOptions {
  workingDirectory?: string;
  workflowPaths?: string;
}

export class SelfValidator {
  private workingDirectory: string;
  private workflowPaths: string;

  constructor(options: SelfValidateOptions = {}) {
    this.workingDirectory = options.workingDirectory || '.';
    this.workflowPaths = options.workflowPaths || '.github/workflows/*.yaml,.github/workflows/*.yml';
  }

  async validate(): Promise<ValidationResult> {
    // Show processing state immediately so users know validation is running
    await setProcessingState();

    // Validate workflows first
    const workflowResult = validateWorkflows(this.workingDirectory);

    console.log('Found go-actions usage:', workflowResult.actionsFound);

    // If go-actions are being used, validate project structure too
    const allErrors: ValidationError[] = [...workflowResult.errors];

    if (workflowResult.actionsFound.length > 0) {
      console.log('\n🔍 Validating project structure and configuration...');
      const projectResult = validateProject(this.workingDirectory);

      // Convert project validation errors to workflow validation error format
      if (!projectResult.isValid) {
        projectResult.errors.forEach(errorMsg => {
          // Parse golangci-lint specific errors
          if (errorMsg.includes('golangci-lint configuration missing required "version" field')) {
            allErrors.push({
              type: 'missing_file',
              message: 'golangci-lint configuration missing required "version: 2" field',
              file: '.golangci.yml',
              severity: 'error'
            });
          } else if (errorMsg.includes('golangci-lint configuration has unsupported version')) {
            const versionMatch = errorMsg.match(/version: "(.+?)"/);
            const version = versionMatch ? versionMatch[1] : 'unknown';
            allErrors.push({
              type: 'version_mismatch',
              message: 'golangci-lint configuration has unsupported version',
              file: '.golangci.yml',
              expected: '2',
              actual: version,
              severity: 'error'
            });
          } else if (errorMsg.includes('golangci-lint configuration has invalid YAML syntax')) {
            allErrors.push({
              type: 'missing_file',
              message: errorMsg.replace('❌ ', ''),
              file: '.golangci.yml',
              severity: 'error'
            });
          }
        });
      }

      // Add project warnings as informational errors
      if (projectResult.warnings.length > 0) {
        projectResult.warnings.forEach(warningMsg => {
          // Only add golangci-lint related warnings
          if (warningMsg.includes('golangci') || warningMsg.includes('linter')) {
            console.log(`⚠️  ${warningMsg}`);
          }
        });
      }
    }

    const result: ValidationResult = {
      isValid: allErrors.length === 0,
      actionsFound: workflowResult.actionsFound,
      errors: allErrors
    };

    // Set outputs
    core.setOutput('actions_found', result.actionsFound.join(','));
    core.setOutput('validation_failed', (!result.isValid).toString());

    if (!result.isValid) {
      const errorMessages = result.errors.map(error => `- ${error.message}`).join('\n');
      console.log('\n::error::Validation failed:');
      console.log(errorMessages);
      core.setOutput('error_messages', errorMessages);
      core.setFailed(`Validation failed with ${result.errors.length} error(s)`);

      // Store results for unified comment
      await storeJobResults('selfValidate', {
        status: 'failure' as const,
        actionsFound: result.actionsFound,
        errors: result.errors
      });
    } else {
      console.log('✅ All validations passed!');

      // Store results for unified comment
      await storeJobResults('selfValidate', {
        status: 'success' as const,
        actionsFound: result.actionsFound,
        errors: []
      });
    }

    return result;
  }

}

// Export function for direct use
export async function selfValidate(options: SelfValidateOptions = {}): Promise<ValidationResult> {
  const validator = new SelfValidator(options);
  return validator.validate();
}

