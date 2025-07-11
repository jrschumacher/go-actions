"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSelfValidation = runSelfValidation;
exports.default = default_1;
const core = __importStar(require("@actions/core"));
const workflow_validator_1 = require("./workflow-validator");
const unified_pr_comment_1 = require("./unified-pr-comment");
/**
 * Validates go-actions configuration and handles all results
 * Consolidates all self-validation logic in one place for better testing and maintenance
 */
async function runSelfValidation(inputs) {
    try {
        const workingDir = inputs.workingDirectory || '.';
        const workflowPaths = inputs.workflowPaths || '.github/workflows/*.yaml,.github/workflows/*.yml';
        const commentOnPr = inputs.commentOnPr !== false; // Default to true
        console.log('🔍 Validating go-actions configuration...');
        // Run the validation
        const result = (0, workflow_validator_1.validateWorkflows)(workingDir);
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
        }
        else {
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
                await unified_pr_comment_1.UnifiedPRComment.storeResults('selfValidate', selfValidateResult);
                console.log('Stored validation results for unified comment');
            }
            catch (commentError) {
                console.log('Failed to store validation results:', commentError);
                // Don't fail the action if storing fails
            }
        }
        return result;
    }
    catch (error) {
        console.error('Self-validation failed with error:', error);
        core.setFailed(`Self-validation failed: ${error}`);
        throw error;
    }
}
// Default export for simple function call
async function default_1() {
    const inputs = {
        workflowPaths: process.env.INPUT_WORKFLOW_PATHS,
        commentOnPr: (process.env.INPUT_COMMENT_ON_PR || 'true') === 'true',
        workingDirectory: process.env.INPUT_WORKING_DIRECTORY || '.',
    };
    return await runSelfValidation(inputs);
}
//# sourceMappingURL=action-self-validate.js.map