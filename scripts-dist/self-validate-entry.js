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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAllResults = exports.updateUnifiedComment = exports.UnifiedPRComment = exports.WorkflowValidator = exports.validateWorkflows = void 0;
// Entry point for self-validate bundle
var workflow_validator_1 = require("./workflow-validator");
Object.defineProperty(exports, "validateWorkflows", { enumerable: true, get: function () { return workflow_validator_1.validateWorkflows; } });
Object.defineProperty(exports, "WorkflowValidator", { enumerable: true, get: function () { return workflow_validator_1.WorkflowValidator; } });
__exportStar(require("./self-validate"), exports);
var unified_pr_comment_1 = require("./unified-pr-comment");
Object.defineProperty(exports, "UnifiedPRComment", { enumerable: true, get: function () { return unified_pr_comment_1.UnifiedPRComment; } });
Object.defineProperty(exports, "updateUnifiedComment", { enumerable: true, get: function () { return unified_pr_comment_1.updateUnifiedComment; } });
Object.defineProperty(exports, "loadAllResults", { enumerable: true, get: function () { return unified_pr_comment_1.loadAllResults; } });
//# sourceMappingURL=self-validate-entry.js.map