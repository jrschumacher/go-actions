import { validateWorkflows, WorkflowValidator, ValidationResult } from './workflow-validator';
import { storeJobResults } from './unified-pr-comment';
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
    const result = validateWorkflows(this.workingDirectory);
    
    console.log('Found go-actions usage:', result.actionsFound);
    
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

