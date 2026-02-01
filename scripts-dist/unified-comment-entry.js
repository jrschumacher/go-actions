"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postUnifiedComment = exports.loadAllResults = exports.storeJobResults = exports.setProcessingState = exports.updateUnifiedComment = exports.UnifiedPRComment = void 0;
/**
 * Entry point for the unified comment bundle
 * Exports all functions needed by GitHub Actions workflows
 */
var unified_pr_comment_1 = require("./unified-pr-comment");
Object.defineProperty(exports, "UnifiedPRComment", { enumerable: true, get: function () { return unified_pr_comment_1.UnifiedPRComment; } });
Object.defineProperty(exports, "updateUnifiedComment", { enumerable: true, get: function () { return unified_pr_comment_1.updateUnifiedComment; } });
Object.defineProperty(exports, "setProcessingState", { enumerable: true, get: function () { return unified_pr_comment_1.setProcessingState; } });
Object.defineProperty(exports, "storeJobResults", { enumerable: true, get: function () { return unified_pr_comment_1.storeJobResults; } });
Object.defineProperty(exports, "loadAllResults", { enumerable: true, get: function () { return unified_pr_comment_1.loadAllResults; } });
var action_comment_1 = require("./action-comment");
Object.defineProperty(exports, "postUnifiedComment", { enumerable: true, get: function () { return action_comment_1.postUnifiedComment; } });
//# sourceMappingURL=unified-comment-entry.js.map