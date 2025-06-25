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
exports.SelfValidator = void 0;
exports.selfValidate = selfValidate;
const workflow_validator_1 = require("./workflow-validator");
const unified_pr_comment_1 = require("./unified-pr-comment");
const core = __importStar(require("@actions/core"));
class SelfValidator {
    constructor(options = {}) {
        this.workingDirectory = options.workingDirectory || '.';
        this.workflowPaths = options.workflowPaths || '.github/workflows/*.yaml,.github/workflows/*.yml';
    }
    async validate() {
        const result = (0, workflow_validator_1.validateWorkflows)(this.workingDirectory);
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
            await (0, unified_pr_comment_1.storeJobResults)('selfValidate', {
                status: 'failure',
                actionsFound: result.actionsFound,
                errors: result.errors
            });
        }
        else {
            console.log('✅ All validations passed!');
            // Store results for unified comment
            await (0, unified_pr_comment_1.storeJobResults)('selfValidate', {
                status: 'success',
                actionsFound: result.actionsFound,
                errors: []
            });
        }
        return result;
    }
}
exports.SelfValidator = SelfValidator;
// Export function for direct use
async function selfValidate(options = {}) {
    const validator = new SelfValidator(options);
    return validator.validate();
}
//# sourceMappingURL=self-validate.js.map