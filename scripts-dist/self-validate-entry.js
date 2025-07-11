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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.actionSelfValidate = exports.runSelfValidation = exports.loadAllResults = exports.updateUnifiedComment = exports.UnifiedPRComment = exports.WorkflowValidator = exports.validateWorkflowsForAction = exports.validateWorkflows = void 0;
// Entry point for self-validate bundle
var workflow_validator_1 = require("./workflow-validator");
Object.defineProperty(exports, "validateWorkflows", { enumerable: true, get: function () { return workflow_validator_1.validateWorkflows; } });
Object.defineProperty(exports, "validateWorkflowsForAction", { enumerable: true, get: function () { return workflow_validator_1.validateWorkflowsForAction; } });
Object.defineProperty(exports, "WorkflowValidator", { enumerable: true, get: function () { return workflow_validator_1.WorkflowValidator; } });
__exportStar(require("./self-validate"), exports);
var unified_pr_comment_1 = require("./unified-pr-comment");
Object.defineProperty(exports, "UnifiedPRComment", { enumerable: true, get: function () { return unified_pr_comment_1.UnifiedPRComment; } });
Object.defineProperty(exports, "updateUnifiedComment", { enumerable: true, get: function () { return unified_pr_comment_1.updateUnifiedComment; } });
Object.defineProperty(exports, "loadAllResults", { enumerable: true, get: function () { return unified_pr_comment_1.loadAllResults; } });
var action_self_validate_1 = require("./action-self-validate");
Object.defineProperty(exports, "runSelfValidation", { enumerable: true, get: function () { return action_self_validate_1.runSelfValidation; } });
var action_self_validate_2 = require("./action-self-validate");
Object.defineProperty(exports, "actionSelfValidate", { enumerable: true, get: function () { return __importDefault(action_self_validate_2).default; } });
//# sourceMappingURL=self-validate-entry.js.map