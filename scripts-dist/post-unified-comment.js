"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postUnifiedComment = postUnifiedComment;
exports.main = main;
const unified_pr_comment_1 = require("./unified-pr-comment");
async function postUnifiedComment() {
    try {
        console.log('Loading stored CI results for unified comment...');
        const results = await (0, unified_pr_comment_1.loadAllResults)();
        console.log('Loaded results:', JSON.stringify(results, null, 2));
        if (Object.keys(results).length === 0) {
            console.log('No CI results found, skipping unified comment');
            return;
        }
        await (0, unified_pr_comment_1.updateUnifiedComment)(results);
        console.log('Unified PR comment updated successfully');
    }
    catch (error) {
        console.error('Failed to post unified comment:', error);
        // Don't fail the workflow if commenting fails
    }
}
// Export for direct use in GitHub Actions
async function main() {
    await postUnifiedComment();
}
//# sourceMappingURL=post-unified-comment.js.map