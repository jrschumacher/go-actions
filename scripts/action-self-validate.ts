import * as core from '@actions/core';
import { validateWorkflows, ValidationResult } from './workflow-validator';
import { UnifiedPRComment } from './unified-pr-comment';

export interface SelfValidateInputs {
  workflowPaths?: string;
  commentOnPr?: boolean;
  workingDirectory?: string;
}

/**
 * Validates go-actions configuration and handles all results
 * Consolidates all self-validation logic in one place for better testing and maintenance
 */
export async function runSelfValidation(inputs: SelfValidateInputs): Promise<ValidationResult> {
  try {
    const workingDir = inputs.workingDirectory || '.';
    const workflowPaths = inputs.workflowPaths || '.github/workflows/*.yaml,.github/workflows/*.yml';
    const commentOnPr = inputs.commentOnPr !== false; // Default to true
    
    console.log('🔍 Validating go-actions configuration...');
    
    // Run the validation
    const result = validateWorkflows(workingDir);
    
    console.log('Found go-actions usage:', result.actionsFound);
    
    // Set GitHub Action outputs
    core.setOutput('actions_found', result.actionsFound.join(','));
    core.setOutput('validation_failed', (!result.isValid).toString());
    
    if (!result.isValid) {
      const errorMessages = result.errors.map(error => `- ${error.message}`).join('\n');
      console.log('\n::error::Validation failed:');
      console.log(errorMessages);
      core.setOutput('error_messages', errorMessages);
      core.setFailed(`Validation failed with ${result.errors.length} error(s)`);
    } else {
      console.log('✅ All validations passed!');
    }
    
    // Store results for unified PR comment (if this is a PR)
    if (commentOnPr && process.env.GITHUB_EVENT_NAME === 'pull_request') {
      try {
        const selfValidateResult = {
          status: result.isValid ? 'success' : 'failure',
          actionsFound: result.actionsFound,
          errors: result.errors
        };
        
        // Store this job's results for later comment consolidation
        await UnifiedPRComment.storeResults('selfValidate', selfValidateResult);
        console.log('Stored validation results for unified comment');
      } catch (commentError) {
        console.log('Failed to store validation results:', commentError);
        // Don't fail the action if storing fails
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('Self-validation failed with error:', error);
    core.setFailed(`Self-validation failed: ${error}`);
    throw error;
  }
}

// Default export for simple function call
export default async function() {
  const inputs: SelfValidateInputs = {
    workflowPaths: process.env.INPUT_WORKFLOW_PATHS,
    commentOnPr: (process.env.INPUT_COMMENT_ON_PR || 'true') === 'true',
    workingDirectory: process.env.INPUT_WORKING_DIRECTORY || '.',
  };
  
  return await runSelfValidation(inputs);
}