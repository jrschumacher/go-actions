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
exports.postUnifiedComment = postUnifiedComment;
exports.default = default_1;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const unified_pr_comment_1 = require("./unified-pr-comment");
/**
 * Posts unified CI results comment to pull requests
 * Consolidates all comment logic in one place for better testing and maintenance
 */
async function postUnifiedComment(githubToken) {
    try {
        // Only run on pull requests
        if (github.context.eventName !== 'pull_request') {
            console.log('Not a pull request, skipping comment');
            return;
        }
        console.log('Loading stored CI results for unified comment...');
        // Load all stored CI results from artifacts
        const allResults = await unified_pr_comment_1.UnifiedPRComment.loadStoredResults();
        console.log('Loaded results:', JSON.stringify(allResults, null, 2));
        // Check if we have any results to report
        const hasResults = Object.keys(allResults).some(key => {
            const result = allResults[key];
            return result && result.status !== 'skipped';
        });
        if (!hasResults) {
            console.log('No CI results found to report');
            return;
        }
        // Create the unified comment using the existing updateComment method
        const commenter = new unified_pr_comment_1.UnifiedPRComment();
        await commenter.updateComment(allResults);
        console.log('Unified comment posted successfully');
    }
    catch (error) {
        console.error('Failed to post unified comment:', error);
        // Don't fail the workflow if commenting fails
        core.warning(`Comment posting failed: ${error}`);
    }
}
// Default export for simple function call
async function default_1() {
    const githubToken = process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    await postUnifiedComment(githubToken);
}
//# sourceMappingURL=action-comment.js.map