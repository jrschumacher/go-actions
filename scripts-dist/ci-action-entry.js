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
exports.parseGovulncheckText = exports.parseGovulncheckJson = exports.formatSecurityOutputForPR = exports.getWorkflowLogsUrl = exports.formatLintOutputForPR = exports.actionComment = exports.postUnifiedComment = exports.loadAllResults = exports.updateUnifiedComment = exports.UnifiedPRComment = exports.runBenchmarks = exports.extractCoverage = void 0;
// Entry point for ci-action bundle
var coverage_extractor_1 = require("./coverage-extractor");
Object.defineProperty(exports, "extractCoverage", { enumerable: true, get: function () { return coverage_extractor_1.extractCoverage; } });
var benchmark_runner_1 = require("./benchmark-runner");
Object.defineProperty(exports, "runBenchmarks", { enumerable: true, get: function () { return benchmark_runner_1.runBenchmarks; } });
__exportStar(require("./ci-action"), exports);
var unified_pr_comment_1 = require("./unified-pr-comment");
Object.defineProperty(exports, "UnifiedPRComment", { enumerable: true, get: function () { return unified_pr_comment_1.UnifiedPRComment; } });
Object.defineProperty(exports, "updateUnifiedComment", { enumerable: true, get: function () { return unified_pr_comment_1.updateUnifiedComment; } });
Object.defineProperty(exports, "loadAllResults", { enumerable: true, get: function () { return unified_pr_comment_1.loadAllResults; } });
var action_comment_1 = require("./action-comment");
Object.defineProperty(exports, "postUnifiedComment", { enumerable: true, get: function () { return action_comment_1.postUnifiedComment; } });
var action_comment_2 = require("./action-comment");
Object.defineProperty(exports, "actionComment", { enumerable: true, get: function () { return __importDefault(action_comment_2).default; } });
var lint_formatter_1 = require("./lint-formatter");
Object.defineProperty(exports, "formatLintOutputForPR", { enumerable: true, get: function () { return lint_formatter_1.formatLintOutputForPR; } });
Object.defineProperty(exports, "getWorkflowLogsUrl", { enumerable: true, get: function () { return lint_formatter_1.getWorkflowLogsUrl; } });
var security_formatter_1 = require("./security-formatter");
Object.defineProperty(exports, "formatSecurityOutputForPR", { enumerable: true, get: function () { return security_formatter_1.formatSecurityOutputForPR; } });
Object.defineProperty(exports, "parseGovulncheckJson", { enumerable: true, get: function () { return security_formatter_1.parseGovulncheckJson; } });
Object.defineProperty(exports, "parseGovulncheckText", { enumerable: true, get: function () { return security_formatter_1.parseGovulncheckText; } });
// Note: action-ci.ts was removed as it duplicated ci-action.ts functionality
// The CIAction class from ci-action.ts is the canonical implementation
//# sourceMappingURL=ci-action-entry.js.map